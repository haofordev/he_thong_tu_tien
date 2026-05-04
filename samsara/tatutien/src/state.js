export const state = {
    accountIndex: 0,
    charName: "Đang tải...",
    latestLevel: 0,
    hp: 0,
    mp: 0,
    stamina: 0,
    spirit: 0,
    spiritStones: 0,
    inventory: {},
    exp: {
        current: 0,
        next: 0,
        percent: 0,
        claimable: 0
    },
    messages: {
        latest: "Đang khởi tạo...",
        boss: "Đang tìm mục tiêu...",
        afk: "Đang tải...",
        pvp: "Chưa có dữ liệu",
        alchemy: "Đang chờ..."
    },
    ranking: {
        rank: 0,
        score: 0,
        gapNext: 0,
        gapTop: 0
    },
    quest: {
        rank: "N/A",
        level: "0/0",
        mobs: "0/0",
        elite: "0/0",
        boss: "0/0",
        pvp: "0/0",
        craft: "0/0"
    },
    combatLogs: [],
    realmId: null,
    activeMapCode: "sect_lk_c01",
    bodyPriority: "top_cp",
    lastUpdate: null
};
