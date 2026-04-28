import { WebSocket } from "ws"
import { loginGetCookies } from "../login.js"
import { yellowBold, redBold, greenBold, sendEncrypted, logWithTime, socketDomain } from "../utils.js"

const cookieCache = {}
const keysCache = {}
const accountState = {}
let currentLevel = 0

// 0 pet 1 wife
const type = 0
const targetLevel = 14995

function clearAccountTimers(email) {
  const s = accountState[email]
  if (!s) return

  if (s.pingInterval) clearInterval(s.pingInterval)
  if (s.loopTimer) clearTimeout(s.loopTimer)
  if (s.upgradeWatchdog) clearInterval(s.upgradeWatchdog) // clear upgrade watchdog timer

  s.pingInterval = null
  s.loopTimer = null
  s.upgradeWatchdog = null
}

async function connectSocket(props) {
  const { email, password } = props

  // Khởi tạo state nếu chưa có
  if (!accountState[email]) {
    accountState[email] = {
      pingInterval: null,
      loopTimer: null,
      upgradeWatchdog: null, // add upgrade watchdog
      isReconnecting: false,
      lastUpgradeTime: Date.now(), // track last upgrade time
    }
  }

  const state = accountState[email]

  if (state.isReconnecting) return
  state.isReconnecting = true

  const data = await loginGetCookies(email, password).catch(() => null)
  if (!data) {
    console.log(redBold(`❌ [${email}] Không lấy được cookie → STOP`))
    state.isReconnecting = false
    return
  }

  cookieCache[email] = data.cookies
  const user = data.user || {}

  console.log("\n" + yellowBold(`=== [${user.name}] KẾT NỐI WEBSOCKET ===`))

  const socket = new WebSocket(socketDomain, {
    headers: { cookie: cookieCache[email] },
  })

  let lastMessage = Date.now()

  const watchdog = setInterval(() => {
    if (Date.now() - lastMessage > 30000) {
      console.log(redBold(`❌ [${user.name}] 30s không có message → Reconnect`))
      socket.close()
    }
  }, 5000)

  const upgradeWatchdog = setInterval(() => {
    if (Date.now() - state.lastUpgradeTime > 5000) {
      console.log(yellowBold(`⚠️ [${user.name}] 5s không tăng cấp → Reconnect`))
      socket.close()
    }
  }, 3000)

  state.upgradeWatchdog = upgradeWatchdog

  const runTasksSequentially = async (times) => {
    if (!socket || socket.readyState !== 1) return

    const tasks = []

    for (let i = 0; i < times; i++) {
      tasks.push(async () => {
        let obj = {}

        if (type == 0) {
          obj = { type: "pet:upgrade", payload: { petId: user.pet._id } }
          console.log("🚀 ~ runTasksSequentially ~ user.pet._id:", user.pet._id)
        } else {
          obj = { type: "wife:upgrade", payload: { wifeId: user.wife._id } }
        }

        sendEncrypted({
          socket,
          obj,
          key: keysCache[email],
        })
      })
    }

    for (const task of tasks) {
      if (currentLevel > targetLevel) {
        process.exit(0)
      }
      console.log(`🎉 ${currentLevel} `)

      await task()
      await new Promise((resolve) => setTimeout(resolve, 800))
    }
  }

  socket.on("open", () => {
    console.log(greenBold(`✅ [${user.name}] WebSocket connected`))
    state.isReconnecting = false
    state.lastUpgradeTime = Date.now() // reset upgrade timer on connect

    if (state.pingInterval) clearInterval(state.pingInterval)
    state.pingInterval = setInterval(() => {
      socket.send(JSON.stringify({ type: "ping" }))
    }, 10000)
  })

  socket.on("message", (msg) => {
    try {
      lastMessage = Date.now()
      const data = JSON.parse(msg.toString())

      switch (data.type) {
        case "sessionKey": {
          const key = {
            aesKey: Buffer.from(data.payload.aesKey, "base64"),
            hmacKey: Buffer.from(data.payload.hmacKey, "base64"),
            staticIv: Buffer.from(data.payload.iv, "base64"),
          }
          keysCache[email] = key

          if (type == 0) {
            console.log(user.pet?.evolveLevel, targetLevel)

            if (user.pet && user.pet?.evolveLevel < targetLevel) {
              currentLevel = user.pet.evolveLevel
            } else {
              console.log("Cấp pet hiện tại đã cao hơn mục tiêu dừng")
              process.exit(0)
            }
          } else {
            if (user.wife && user.wife?.harmonyLevel < targetLevel) {
              currentLevel = user.wife.harmonyLevel
            } else {
              console.log("Cấp đạo lữ hiện tại cao hơn mục tiêu dừng")
              process.exit(0)
            }
          }
          runTasksSequentially(50)
          break
        }
        case "error":
          logWithTime(redBold(`[${user.name}] ${data.payload?.text}`))
          break
        case "system":
          if (
            data.payload?.text?.includes("Linh thú đã đột phá") ||
            data.payload?.text?.includes("Đạo Lữ đã tăng độ hòa hợp")
          ) {
            currentLevel++
            state.lastUpgradeTime = Date.now() // reset upgrade timer when upgraded
          }
          logWithTime(greenBold(`[${user.name}] ${data.payload?.text}`))
          break

        case "warn":
          logWithTime(yellowBold(`[${user.name}] ${data.payload.text}`))
          break
      }
    } catch (e) {
      console.error(`❌ [${user.name}] Parse error:`, e)
    }
  })

  socket.on("close", () => {
    console.log(redBold(`⚠️ [${user.name}] Socket closed → reconnecting...`))

    clearAccountTimers(email)
    clearInterval(watchdog)

    setTimeout(() => {
      accountState[email].isReconnecting = false
      connectSocket(props)
    }, 1000)
  })

  socket.on("error", (err) => console.log(redBold(`⚠️ [${user.name}] Socket error:`), err))
}

const ACCOUNTS = [{ email: "thienhoa002@gmail.com", password: "MK112233" }]

for (const acc of ACCOUNTS) {
  connectSocket(acc)
}
