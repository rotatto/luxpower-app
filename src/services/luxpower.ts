import { supabase } from '../lib/supabase';

let cachedSessionId: string | null = null;

// ─── Edge Function Callers ────────────────────────────────────────────────────

async function luxInvoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('luxpower', { body });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'LuxPower API error');
  return data;
}

async function deyeInvoke(endpoint: string, body: object = {}) {
  const { data, error } = await supabase.functions.invoke('deye-api', {
    body: { endpoint, body },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── Session Management ───────────────────────────────────────────────────────

function isSessionExpiredError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return msg.includes('session') || msg.includes('login') || msg.includes('jsessionid');
}

async function getSessionId(): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const data = await luxInvoke({ action: 'login' });
  cachedSessionId = data.sessionId;
  return data.sessionId;
}

async function withSessionRetry<T>(fn: (sessionId: string) => Promise<T>): Promise<T> {
  const sessionId = await getSessionId();
  try {
    return await fn(sessionId);
  } catch (e) {
    if (!isSessionExpiredError(e)) throw e;
    cachedSessionId = null;
    const newSessionId = await getSessionId();
    return await fn(newSessionId);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class LuxPowerService {
  /**
   * "Login" for the app: calls the edge function login to verify connectivity.
   * Actual LuxPower credentials are stored server-side in the edge function env.
   * The account param is used only as the display name in the app.
   */
  async login(account: string, _password: string) {
    const data = await luxInvoke({ action: 'login' });
    cachedSessionId = data.sessionId;
    return { success: true, user: account };
  }

  async getAllPlants() {
    return withSessionRetry(async (sessionId) => {
      const data = await luxInvoke({ action: 'plants', sessionId });
      return data.plants ?? [];
    });
  }

  /**
   * Returns plants enriched with inverter info (serialNum, online status, model, battery type).
   * Used by the plants list screen to show status badges and enable navigation to dashboard.
   */
  async getPlantsSummary() {
    return withSessionRetry(async (sessionId) => {
      const data = await luxInvoke({ action: 'plants', sessionId });
      const plants: any[] = data.plants ?? [];

      // Fetch inverters for each plant in parallel to get serialNum + status
      const enriched = await Promise.all(
        plants.map(async (plant: any) => {
          try {
            const invData = await luxInvoke({
              action: 'inverters',
              sessionId,
              plantId: String(plant.plantId),
            });
            const inverters: any[] = invData.inverters ?? [];
            const first = inverters[0];
            const onlineCount = inverters.filter((i: any) => !i.lost).length;
            return {
              ...plant,
              serialNum: first?.serialNum ?? null,
              powerRatingText: first?.powerRatingText ?? '',
              batteryType: first?.batteryType ?? '',
              inverterCount: inverters.length,
              onlineCount,
              isOnline: onlineCount > 0,
            };
          } catch {
            return {
              ...plant,
              serialNum: null,
              isOnline: false,
              onlineCount: 0,
              inverterCount: 0,
            };
          }
        })
      );

      const onlineCount = enriched.filter((p: any) => p.isOnline).length;
      return { plants: enriched, total: enriched.length, onlineCount };
    });
  }

  async getInverters(plantId: number) {
    return withSessionRetry(async (sessionId) => {
      const data = await luxInvoke({
        action: 'inverters',
        sessionId,
        plantId: String(plantId),
      });
      return { rows: data.inverters ?? [] };
    });
  }

  async getRuntime(serialNum: string) {
    try {
      return await withSessionRetry(async (sessionId) => {
        const data = await luxInvoke({ action: 'realtime', sessionId, serialNum, parallel: false });
        return data.data ?? {};
      });
    } catch (e) {
      console.error('[LuxPower] Erro no runtime:', e);
      return {};
    }
  }

  async getHistory(serialNum: string, date?: string) {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateText =
      date ??
      `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    return withSessionRetry(async (sessionId) => {
      const data = await luxInvoke({
        action: 'history',
        sessionId,
        serialNum,
        dateText,
        parallel: false,
      });
      return data;
    });
  }

  async getEnergyInfo(serialNum: string) {
    return withSessionRetry(async (sessionId) => {
      const data = await luxInvoke({ action: 'energyInfo', sessionId, serialNum, parallel: false });
      return data.data ?? {};
    });
  }

  async getMonthly(serialNum: string, year: number, month: number) {
    return withSessionRetry(async (sessionId) => {
      const data = await luxInvoke({ action: 'monthly', sessionId, serialNum, year, month, parallel: false });
      return data.data ?? [];
    });
  }

  // ─── Deye ──────────────────────────────────────────────────────────────────

  async getDeyeStations() {
    const data = await deyeInvoke('stations', {});
    const stations: any[] = data.stationList ?? [];
    return stations.map((s: any) => ({
      ...s,
      isOnline: s.connectionStatus === 'NORMAL',
      locationAddress: s.locationAddress ?? s.address ?? '',
    }));
  }

  async getDeyeRealtime(stationId: number) {
    const data = await deyeInvoke('station-latest', { stationId });
    return data;
  }
}

export const luxPowerService = new LuxPowerService();
