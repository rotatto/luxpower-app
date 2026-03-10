const PROXY_URL = 'http://10.0.2.2:3000';

class LuxPowerService {

  async login(account: string, password: string) {
    const res = await fetch(`${PROXY_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password }),
    });
    const data = await res.json();
    console.log('[LuxPower] Login:', JSON.stringify(data));
    if (!data.success) throw new Error('Login falhou');
    return data;
  }

  async getAllPlants() {
    const res = await fetch(`${PROXY_URL}/plants`);
    const data = await res.json();
    console.log('[LuxPower] Plantas:', data.total);
    return data.plants ?? [];
  }

  async getPlantsSummary() {
    const res = await fetch(`${PROXY_URL}/plants/summary`);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      console.log('[LuxPower] Summary:', data.total, 'plantas,', data.onlineCount, 'online');
      return data;
    } catch (e) {
      console.error('[LuxPower] Erro ao parsear summary:', text.substring(0, 200));
      throw new Error('Resposta inválida do servidor');
    }
  }

  async getInverters(plantId: number) {
    const res = await fetch(`${PROXY_URL}/inverters/${plantId}`);
    const data = await res.json();
    return { rows: data.inverters ?? [] };
  }

  async getRuntime(serialNum: string) {
    const res = await fetch(`${PROXY_URL}/runtime/${serialNum}`);
    const data = await res.json();
    return data.data;
  }

  async getHistory(serialNum: string, date?: string) {
    const dateParam = date ? `?date=${date}` : '';
    const res = await fetch(`${PROXY_URL}/history/${serialNum}${dateParam}`);
    const data = await res.json();
    console.log('[LuxPower] Histórico:', JSON.stringify(data).substring(0, 200));
    return data;
}
}

export const luxPowerService = new LuxPowerService();