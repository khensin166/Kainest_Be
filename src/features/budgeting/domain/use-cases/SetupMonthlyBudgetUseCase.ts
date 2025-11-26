import { budgetRepository } from "../../data/BudgetRepository.js";

type SetupData = {
  userId: string;
  salary: number;
  rentAmount: number; // Biaya Kos/Cicilan tetap
  savingTargetPercent?: number; // Default 20%
};

export const setupMonthlyBudgetUseCase = async (data: SetupData) => {
  try {
    const { userId, salary, rentAmount, savingTargetPercent = 0.2 } = data;

    // 1. Tentukan Tanggal Periode (Awal Bulan Ini)
    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Ambil Master Categories
    // Asumsi: Kita sudah seed kategori standar di DB (Food, Transport, Rent, Entertainment, Savings)
    const categories = await budgetRepository.findAllCategories();
    
    // Helper cari ID kategori by name (Case insensitive match logic perlu disesuaikan dgn data seed)
    const findCatId = (name: string) => categories.find(c => c.name.toLowerCase().includes(name))?.id;

    // 3. RULE ENGINE LOGIC (Kenin Blueprint) 📐
    
    // A. Fixed Costs (Rent/Kos)
    const rentBudget = rentAmount;

    // B. Food (Rule: 45k x 30 hari = 1.35jt, tapi max 25% gaji)
    const defaultFood = 45000 * 30; 
    const maxFood = salary * 0.25; 
    const foodBudget = Math.min(defaultFood, maxFood);

    // C. Transport (Default 300k atau 5% gaji)
    const transportBudget = 300000;

    // D. Savings (20% Gaji)
    const savingsBudget = salary * savingTargetPercent;

    // E. Entertainment / Others (Sisa Gaji)
    const basicNeeds = rentBudget + foodBudget + transportBudget + savingsBudget;
    let entertainmentBudget = salary - basicNeeds;
    
    if (entertainmentBudget < 0) {
        // Jika gaji ngepas, kurangi savings/entertainment
        entertainmentBudget = 0;
    }

    // 4. Simpan ke Database (Upsert)
    const idMakan = findCatId('makan') || findCatId('food');
    const idTrans = findCatId('transport');
    const idKos = findCatId('kos') || findCatId('rent');
    const idHiburan = findCatId('hiburan') || findCatId('entertainment');
    const idTabungan = findCatId('tabungan') || findCatId('saving');

    const promises = [];

    if (idMakan) promises.push(budgetRepository.upsertBudget(userId, idMakan, period, foodBudget));
    if (idTrans) promises.push(budgetRepository.upsertBudget(userId, idTrans, period, transportBudget));
    if (idKos) promises.push(budgetRepository.upsertBudget(userId, idKos, period, rentBudget));
    if (idHiburan) promises.push(budgetRepository.upsertBudget(userId, idHiburan, period, entertainmentBudget));
    // Tabungan biasanya bukan expense limit, tapi goal. Bisa disimpan sbg budget jg kalau mau ditrack.

    await Promise.all(promises);

    return { 
      success: true, 
      message: "Budget baseline created successfully",
      data: {
        total_allocated: basicNeeds + entertainmentBudget,
        details: { food: foodBudget, rent: rentBudget, transport: transportBudget, entertainment: entertainmentBudget }
      }
    };

  } catch (error) {
    console.error("Setup Budget Error:", error);
    return { success: false, status: 500, message: "Failed to setup budget" };
  }
};