

import { WebSocket } from "ws";
import { loginGetCookies } from "../login.js";
import { yellowBold, redBold, greenBold, sendEncrypted, logWithTime, socketDomain } from "../utils.js";

const cookieCache = {}
const keysCache = {}
let spendSpiritStone = 0
let timeStop = 0
let curenntHonor = 0
let stateTimeout = null;

const fullKey = {
    "spiritStone": "Linh Thạch",
    "honor": "Công Đức",
    "towerToken": "Xu Tháp",
    "bach_luyen_ngoc": "Bách Luyện Ngọc",
    "cao_cap_bach_luyen_ngoc": "Cao Cấp Bách Luyện Ngọc",
    "pha_giap_ngoc_so": "Phá Giáp Ngọc (Sơ)",
    "huyet_mach_tinh_hoa": "Huyết Mạch Tinh Hoa",
    "huyet_mach_thach": "Huyết Mạch Thạch",
    "moi_thuong": "Mồi Giun Đất",
    "moi_cao_cap": "Linh Tủy Tôm",
    "huyen_tinh": "Huyền Tinh",
    "gift_dong_tam_ket": "Đồng Tâm Kết",
    "gift_luu_ly_boi": "Lưu Ly Bội",
    "gift_bich_hai_khuc": "Bích Hải Triều Sinh Khúc",
    "stamina_recovery_pill_120": "Hồi Lực Đan",
    "speed_gem_pouch": "Túi Đá Thân Pháp",
    "hp_gem_pouch": "Túi Đá Thể Phách",
    "atk_gem_pouch": "Túi Đá Lực Tay",
    "def_gem_pouch": "Túi Đá Căn Cốt",
    "item_033": "Miễn Thương Ngọc (Sơ)",
    "item_032": "Nộ Kích Ngọc (Sơ)",
    "firework_2_9": "Pháo Hoa Mừng Lễ",
    "phong_bao_2_9": "Phong Bao Mừng Lễ",
    "item_031": "Chân Thương Ngọc (Sơ)",
    "tinhDieuBan": "Tinh Diệu Bàn",
    "nguHanhKy": "Ngũ Hành Kỳ",
    "dao_road_soul": "Linh Hồn Đạo Lộ",
    "item_029": "Liên Kích Ngọc (Sơ)",
    "item_030": "Trấn Kích Ngọc (Sơ)",
    "den_long_scroll": "Đèn Lồng",
    "blessing_scroll": "Thẻ Thỉnh Tiên",
    "sect_merit": "Chiến Công Tông Môn",
    "formation-divine-choose": "Rương Trận pháp (Tự Chọn)",
    "pet-chest-divine-choose": "Rương Linh Thú Thần Phẩm (Tự Chọn)",
    "wife-divine-choose": "Rương Đạo Lữ Thần Phẩm (Tự Chọn)",
    "training_upgrade_point": "Đạo Trì Tinh Hoa",
    "soul_crystal": "Hồn Tinh",
    "hong_mong_stone": "Hồng Mông Khoáng Thạch",
    "merit-chest": "Rương Công Đức (Nhỏ)",
    "pet-chest-common": "Trang Bị Linh Thú Phàm Phẩm",
    "pet-chest-spiritual": "Trang Bị Linh Thú Linh phẩm",
    "pet-chest-mystic": "Rương Linh Thú Huyền phẩm",
    "pet-chest-immortal": "Trang Bị Linh Thú Tiên phẩm",
    "pet-chest-divine": "Trang Bị Linh Thú Thần phẩm",
    "swordSoul": "Linh Hồn Kiếm Đạo",
    "bodyCore": "Thể Cốt Linh Châu",
    "eyeMark": "Ấn Chú Mục Đạo",
    "devilCore": "Ma Linh Tà Đan",
    "item_001": "Tinh Thạch",
    "wife_essence": "Tín Vật Bồi Dưỡng",
    "wife_bond_scroll": "Thẻ Duyên Phận Đạo Lữ",
    "pet_essence": "Tinh Hoa Linh Thú",
    "pet_summon_scroll": "Thẻ Triệu Hồi Linh Thú",
    "artifact_summon_scroll": "Thẻ Triệu Hồi Pháp Bảo",
    "refine_scroll_basic": "Phù Tẩy Luyện Thô",
    "refine_scroll_mystic": "Phù Tẩy Luyện Huyền",
    "refine_scroll_immortal": "Phù Tẩy Luyện Tiên Phẩm",
    "item_002_low": "Huyết Ngọc (Sơ)",
    "item_002": "Huyết Ngọc",
    "item_003_low": "Lôi Ngọc (Sơ)",
    "item_003": "Lôi Ngọc",
    "item_004_low": "Hỏa Ngọc (Sơ)",
    "item_004": "Hỏa Ngọc",
    "item_005_low": "Trấn Ngọc (Sơ)",
    "item_005": "Trấn Ngọc",
    "item_006": "Thiên Lôi Ngọc",
    "item_007": "Thổ Ngọc",
    "item_008": "Diệm Ngọc",
    "yuan_shen_stone": "Nguyên Thạch",
    "item_009": "Trấn Ngọc",
    "item_010": "Tịch Ngọc",
    "item_012": "Khóa Ngọc",
    "item_013": "Cực Lôi Ngọc",
    "item_013_anti": "Kháng Lôi Ngọc",
    "item_014": "Thổ Ngọc (Sơ)",
    "item_015": "Diệm Ngọc (Sơ)",
    "item_016": "Phong Ngọc",
    "item_017": "Băng Ngọc",
    "item_018": "Ảnh Ngọc",
    "item_019": "Trảm Ngọc",
    "item_020": "Thủy Ngọc",
    "item_021": "Sinh Ngọc",
    "item_022": "Hoả Ngọc (Trung)",
    "item_023": "Thể Ngọc",
    "item_024": "Phi Ngọc (Trung)",
    "item_025": "Ngọc Tu Luyện",
    "ngoc_linh_thach": "Ngọc Linh Thạch",
    "item_026": "Phản Kích (Sơ)",
    "item_027": "Kháng Phản Kích (Sơ)",
    "item_028": "Sinh Ngọc (Sơ)",
    "item_011": "Phi Ngọc"
}

async function connectSocket(props) {
    const { email, password } = props;

    let user = {};

    if (!cookieCache[email]) {
        const data = await loginGetCookies(email, password);
        if (!data) {
            console.log(redBold(`❌ Không lấy được cookie, bỏ qua.`));
            return;
        }
        cookieCache[email] = data.cookies;
        user = data.user || {};
    }

    console.log("\n" + yellowBold(`=== [KẾT NỐI TỚI WEBSOCKET ===`));

    const socket = new WebSocket(socketDomain, {
        headers: {
            "accept-language": "en-US,en;q=0.9,vi;q=0.8",
            "cache-control": "no-cache",
            pragma: "no-cache",
            "cookie": cookieCache[email],
        },
    });

    socket.on("open", () => {
        setInterval(() => socket.send(JSON.stringify({ type: "ping", data: {} })), 10000);
        console.log(greenBold(`✅ Kết nối WebSocket thành công`));
    });

    socket.on("message", async (message) => {
        try {
            const data = JSON.parse(message.toString());
            switch (data.type) {
                case "sessionKey":
                    const key = {
                        aesKey: Buffer.from(data.payload.aesKey, "base64"),
                        hmacKey: Buffer.from(data.payload.hmacKey, "base64"),
                        staticIv: Buffer.from(data.payload.iv, "base64")
                    }

                    keysCache[email] = key

                    sendEncrypted({
                        socket,
                        obj: {
                            type: 'stone_gambling:getstate',
                            payload: { targetId: user.userId }
                        },
                        key,
                    });

                    break;

                case "stone_gambling:state":
                    if (stateTimeout) clearTimeout(stateTimeout);

                    stateTimeout = setTimeout(() => {
                        sendEncrypted({
                            socket,
                            obj: {
                                type: 'stone_gambling:getstate',
                                payload: { targetId: user.userId }
                            },
                            key: keysCache[email]
                        });
                    }, 20000);

                    const payload = data.payload;
                    if (!payload) return;

                    if (payload.currentTier < 6) {
                        setTimeout(() => {
                            sendEncrypted({
                                socket,
                                obj: {
                                    type: 'stone_gambling:result',
                                    payload: { currencyType: "spiritStone" }
                                },
                                key: keysCache[email]
                            });
                        }, 500)
                    } else {
                        timeStop++
                        let timeout = 600
                        if (timeStop > 8) {
                            timeout = 8000
                            timeStop = 0
                        }
                        spendSpiritStone += 950000
                        setTimeout(() => {
                            sendEncrypted({
                                socket,
                                obj: {
                                    type: 'stone_gambling:reset',
                                    payload: {}
                                },
                                key: keysCache[email]
                            });
                        }, timeout)
                    }
                    break

                case "stone_gambling:getstate":
                    console.log("")
                    const reward = data?.payload?.reward;
                    if (reward) {
                        logWithTime(greenBold(`[${user.name}] nhận ${fullKey[reward.itemId] || reward.itemId} số lượng ${reward.quantity}`));
                        if (reward.itemId == "honor") {
                            curenntHonor += reward.quantity
                        }
                    }
                    break;
                case "system":
                    logWithTime(greenBold(`[${user.name}] ${data.payload.text}`))
                    break;
                case "warn":
                    console.log("")
                    console.log(yellowBold(`[${user.name}] ${data?.payload?.text}`));
                    break;
            }
        } catch (err) {
            console.error(`❌ Lỗi xử lý message:`, err);
        }
    });
}


async function attackBossAccount() {
    connectSocket({
        email: "thienhoa002@gmail.com",
        password: "MK112233",
    });
}

attackBossAccount()
