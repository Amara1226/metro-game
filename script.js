const grid_container = document.querySelector("#grid_container")
const start_btn = document.querySelector("#start_btn")
const rules_btn = document.querySelector("#rules_btn")
const return_game_btn = document.querySelector("#return_from_game")
const return_rules_btn = document.querySelector("#return_from_rules")
const screens = document.querySelectorAll(".screen")
const timer = document.querySelector("#timer")
const draw_card_btn = document.querySelector("#draw_card_btn")
const current_card = document.querySelector("#current_card")
const deck_size = document.querySelector("#deck_size")
const line_display = document.querySelector("#line_display")
const round_info = document.querySelector("#round_info")
const player_name_input = document.querySelector("#player_name_input")
const player_name_display = document.querySelector("#player_name_display")
const scores_btn = document.querySelector("#scores_btn")
const return_from_scores = document.querySelector("#return_from_scores")
const scores_list = document.querySelector("#scores_list")

let segments = []
let current_line = null
let current_line_index = 0
let drawn_cards_this_round = 0
let last_drawn_card = null
let last_valid_targets = []
let current_endpoint_id = null

let elapsed_time = 0
let timer_interval = 0
let stations = []
let lines = []
let lineStations = {}
let railwayTouchCount = 0


for (let i = 0; i < 100; i++) {
    const square = document.createElement("div")
    square.classList.add("square")
    grid_container.append(square)
}

const squares = document.querySelectorAll("#grid_container .square")

function showScreen(name) {
    screens.forEach(sc => sc.classList.remove("active"))
    document.querySelector(`#${name}`).classList.add("active")

    if (name === "game") {
        const saved = localStorage.getItem("player_name")
        if (saved) player_name_display.textContent = "Player: " + saved
    }
}

async function loadJson() {
    const stationsRes = await fetch("stations.json")
    stations = await stationsRes.json()

    const linesRes = await fetch("lines.json")
    lines = await linesRes.json()

    lines = lines.sort(() => Math.random() - 0.5)
    current_line_index = 0
    current_line = lines[current_line_index]
    current_endpoint_id = current_line.start

    updateRoundInfo()

    stations.forEach(station => {
        const index = station.y * 10 + station.x
        const square = squares[index]
        square.classList.add(`station-${station.type}`)
        square.innerText = station.type

        if (station.train)
            square.style.border = "2px solid black"

        square.dataset.stationId = station.id
    })

    lines.forEach(line => {
        const start_station = stations.find(e => e.id === line.start)
        const index = start_station.y * 10 + start_station.x
        squares[index].style.border = `5px solid ${line.color}`
    })

    highlightEndpoint()
}

loadJson()

function highlightEndpoint() {
    squares.forEach(s => s.classList.remove("endpoint"))
    if (!current_endpoint_id) 
        return
    const st = stations.find(s => s.id === current_endpoint_id)
    if (!st) 
        return
    const idx = st.y * 10 + st.x
    squares[idx].classList.add("endpoint")
}

function updateRoundInfo() {
    round_info.textContent = `${current_line_index + 1} / 4`
    line_display.textContent = current_line.name
    line_display.style.color = current_line.color
}

function timeFormat(sec) {
    let m = Math.floor(sec / 60).toString().padStart(2, "0")
    let s = (sec % 60).toString().padStart(2, "0")
    return `${m}:${s}`
}

function startTimer() {
    elapsed_time = 0
    timer.textContent = timeFormat(elapsed_time)
    timer_interval = setInterval(() => {
        elapsed_time++
        timer.textContent = timeFormat(elapsed_time)
    }, 1000)
}

function stopTimer() {
    clearInterval(timer_interval)
}

start_btn.addEventListener("click", () => {
    const name = player_name_input.value.trim()
    if (name.length > 0)
        localStorage.setItem("player_name", name)

    resetGameState()
    showScreen("game")
    startTimer()
})

rules_btn.addEventListener("click", () => showScreen("rules"))
return_game_btn.addEventListener("click", () => { stopTimer(); showScreen("main_menu") })
return_rules_btn.addEventListener("click", () => showScreen("main_menu"))

const DECK_TEMPLATE = [
    {type:'A', platform:'side'},
    {type:'B', platform:'side'},
    {type:'C', platform:'side'},
    {type:'D', platform:'side'},
    {type:'?', platform:'side'},
    {type:'A', platform:'center'},
    {type:'B', platform:'center'},
    {type:'C', platform:'center'},
    {type:'D', platform:'center'},
    {type:'?', platform:'center'}
]

function shuffle(array) {
    const a = array.slice()
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = a[i]
        a[i] = a[j]
        a[j] = t
    }
    return a
}

let deck = shuffle(DECK_TEMPLATE)

function resetGameState() {
    segments = []
    drawn_cards_this_round = 0
    last_drawn_card = null
    last_valid_targets = []
    deck = shuffle(DECK_TEMPLATE.slice())
    current_line_index = 0
    current_line = lines[current_line_index]
    current_endpoint_id = current_line.start
    lineStations = {}
    lines.forEach(l => lineStations[l.color] = new Set())
    railwayTouchCount = 0

    updateRoundInfo()
    highlightEndpoint()

    squares.forEach(s => {
        s.style.backgroundColor = ""
        s.classList.remove("highlight")
        s.classList.remove("endpoint")
    })

    stations.forEach(station => {
        const index = station.y * 10 + station.x
        const square = squares[index]
        square.classList.add(`station-${station.type}`)
        square.innerText = station.type
        if (station.train)
            square.style.border = "2px solid black"
    })

    lines.forEach(line => {
        const start_station = stations.find(e => e.id === line.start)
        const index = start_station.y * 10 + start_station.x
        squares[index].style.border = `5px solid ${line.color}`
    })

    current_card.textContent = "Please draw a card!"
    deck_size.textContent = ""
}

function isValidEnd(station, cardType) {
    if (cardType === '?') 
        return true
    if (station.type === '?') 
        return true
    return station.type === cardType
}

function isStraightLine(a, b) {
    const dx = Math.abs(a.x - b.x)
    const dy = Math.abs(a.y - b.y)
    return dx === 0 || dy === 0 || dx === dy
}

function passesThroughStation(a, b) {
    const Ax = a.x + 0.5
    const Ay = a.y + 0.5
    const Bx = b.x + 0.5
    const By = b.y + 0.5

    for (let st of stations) {
        if (st.id === a.id || st.id === b.id) continue

        const left = st.x
        const right = st.x + 1
        const top = st.y
        const bottom = st.y + 1

        if (lineIntersectsRect(Ax, Ay, Bx, By, left, top, right, bottom)) {
            return true
        }
    }
    return false
}

function lineIntersectsRect(x1, y1, x2, y2, left, top, right, bottom) {
    if (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) return true
    if (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom) return true

    if (segmentIntersects(x1, y1, x2, y2, left, top, right, top)) return true
    if (segmentIntersects(x1, y1, x2, y2, right, top, right, bottom)) return true
    if (segmentIntersects(x1, y1, x2, y2, right, bottom, left, bottom)) return true
    if (segmentIntersects(x1, y1, x2, y2, left, bottom, left, top)) return true

    return false
}

function segmentIntersects(x1, y1, x2, y2, x3, y3, x4, y4) {
    function ccw(ax, ay, bx, by, cx, cy) {
        return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)
    }
    return ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
           ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
}

function segmentCrosses(a, b) {
    for (let s of segments) {
        const sA = stations.find(x => x.id === s.start)
        const sB = stations.find(x => x.id === s.end)

        if (sA.id === a.id || sA.id === b.id || sB.id === a.id || sB.id === b.id)
            continue

        if (twoSegmentsCross(a, b, sA, sB))
            return true
    }
    return false
}

function twoSegmentsCross(a, b, c, d) {
    function ccw(p1, p2, p3) {
        return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x)
    }

    const A = {x:a.x, y:a.y}
    const B = {x:b.x, y:b.y}
    const C = {x:c.x, y:c.y}
    const D = {x:d.x, y:d.y}

    const inter = ccw(A,C,D) !== ccw(B,C,D) && ccw(A,B,C) !== ccw(A,B,D)

    if (inter) {
        return true
    }

    return false
}

function segmentExists(aId, bId) {
    return segments.some(s =>
        (s.start === aId && s.end === bId) ||
        (s.start === bId && s.end === aId)
    )
}

function connectStations(a, b, color) {
    const dx = Math.sign(b.x - a.x)
    const dy = Math.sign(b.y - a.y)

    let x = a.x
    let y = a.y

    while (x !== b.x || y !== b.y) {
        x += dx
        y += dy

        const stationOnPath = stations.find(s => s.x === x && s.y === y)
        if (stationOnPath && stationOnPath.id !== a.id && stationOnPath.id !== b.id)
            continue

        const index = y * 10 + x
        squares[index].style.backgroundColor = color
    }
}

function segmentsForCurrentLine() {
    return segments.filter(s => s.color === current_line.color)
}

function isStationOnCurrentLine(stationId) {
    const arr = segmentsForCurrentLine()
    if (arr.length === 0) return stationId === current_line.start
    return arr.some(s => s.start === stationId || s.end === stationId)
}

function isEndpoint(stationId) {
    const arr = segmentsForCurrentLine()
    if (arr.length === 0) return stationId === current_line.start
    
    let degree = 0
    arr.forEach(s => {
        if (s.start === stationId) degree++
        if (s.end === stationId) degree++
    })
    return degree == 1
}

function getValidTargets(card) {
    if (!current_endpoint_id) 
        return []
    const from = stations.find(s => s.id === current_endpoint_id)
    if (!from) 
        return []

    const cardType = card.type
    const lineSegments = segments.filter(s => s.color === current_line.color)
    const used = new Set()
    lineSegments.forEach(s => {
        used.add(s.start)
        used.add(s.end)
    })

    const result = []
    stations.forEach(st => {
        if (st.id === from.id) return
        if (!isValidEnd(st, cardType)) return
        if (used.has(st.id)) return
        if (!isStraightLine(from, st)) return
        if (passesThroughStation(from, st)) return
        if (segmentExists(from.id, st.id)) return
        if (segmentCrosses(from, st)) return
        result.push(st)
    })
    return result
}

function hasAnyValidMove(card) {
    const targets = getValidTargets(card)
    return targets.length > 0
}

function drawCard() {
    if (drawn_cards_this_round >= 8)
        return

    if (deck.length === 0)
        deck = shuffle(DECK_TEMPLATE)

    const card = deck.pop()
    last_drawn_card = card
    drawn_cards_this_round++

    current_card.textContent = `${card.type} (${card.platform})`
    deck_size.textContent = `Deck Size: ${deck.length}`

    squares.forEach(s => s.classList.remove("highlight"))

    const targets = getValidTargets(card)
    last_valid_targets = targets.slice()

    targets.forEach(station => {
        const index = station.y * 10 + station.x
        squares[index].classList.add("highlight")
    })

    const hasMove = targets.length > 0

    if (drawn_cards_this_round === 8) {
        if (!hasMove) {
            endRound()
            return
        }
        return
    }

    if (!hasMove) {
    last_valid_targets = []
    return
    }
}

draw_card_btn.addEventListener("click", () => drawCard())

function endRound() {
    current_line_index++

    if (current_line_index >= lines.length) {
        stopTimer()

        let totalRoundPoints = 0
        lines.forEach(l => {
            totalRoundPoints += calculateRoundScore(l.color)
        })
        const PP = railwayPoints(railwayTouchCount)
        const JP = calculateJunctionScore()
        const score = totalRoundPoints + PP + JP
        saveScore(score)

        const name = localStorage.getItem("player_name") || "Unknown"
        const time = elapsed_time

        const resultsDiv = document.querySelector("#inline_results")
        resultsDiv.innerHTML = `
            <div><strong>${name}</strong>, your final score is <strong>${score}</strong>.</div>
            <div>Completion time: ${time} seconds.</div>
            <button id="play_again_btn" style="
                margin-top: 15px;
                padding: 8px 16px;
                background:#0044cc;
                color:white;
                border:none;
                border-radius:6px;
                cursor:pointer;
            ">Play Again</button>
        `
        resultsDiv.style.display = "block"

        document.querySelector("#play_again_btn").addEventListener("click", () => {
            const savedName = localStorage.getItem("player_name") || ""
            resetGameState()
            updateRoundInfo()
            highlightEndpoint()
            document.querySelector("#inline_results").style.display = "none"
            startTimer()
        })

        return
    }

    current_line = lines[current_line_index]
    current_endpoint_id = current_line.start
    drawn_cards_this_round = 0
    last_drawn_card = null
    last_valid_targets = []
    deck = shuffle(DECK_TEMPLATE)
    current_card.textContent = "Please draw a card!"
    deck_size.textContent = ""

    squares.forEach(s => s.classList.remove("highlight"))
    updateRoundInfo()
    highlightEndpoint()
}

function calculateRoundScore(lineColor) {
    const set = lineStations[lineColor]
    if (!set || set.size === 0) return 0
    const list = Array.from(set).map(id => stations.find(s => s.id === id))

    let districts = new Set()
    let districtCount = {}
    let pd = 0

    list.forEach(st => {
        districts.add(st.district)
        districtCount[st.district] = (districtCount[st.district] || 0) + 1
    })

    const arr = Object.values(districtCount)
    if (arr.length === 0) return 0
    const PK = districts.size
    const PM = Math.max(...arr)

    const seg = segments.filter(s => s.color === lineColor)
    seg.forEach(s => {
        const a = stations.find(x => x.id === s.start)
        const b = stations.find(x => x.id === s.end)
        if (a.side !== b.side) pd++
    })

    return PK * PM + pd

}
function railwayPoints(n) {
    const arr = [0,1,2,4,6,8,11,14,17,21,25]
    return arr[Math.min(n, 10)]
}
function calculateJunctionScore() {
    let stationLines = {}
    segments.forEach(s => {
        if (!stationLines[s.start]) stationLines[s.start] = new Set()
        if (!stationLines[s.end]) stationLines[s.end] = new Set()
        const line = lines.find(l => l.color === s.color)
        stationLines[s.start].add(line.name)
        stationLines[s.end].add(line.name)
    })

    let c2 = 0, c3 = 0, c4 = 0

    Object.values(stationLines).forEach(set => {
        if (set.size === 2) c2++
        if (set.size === 3) c3++
        if (set.size === 4) c4++
    })

    return 2*c2 + 5*c3 + 9*c4
}


function saveScore(finalScore) {
    const name = localStorage.getItem("player_name") || "Unknown"
    const time = elapsed_time

    const entry = { name, score: finalScore, time }

    let list = JSON.parse(localStorage.getItem("scoreboard") || "[]")
    list.push(entry)

    list.sort((a, b) => b.score - a.score)

    localStorage.setItem("scoreboard", JSON.stringify(list))
}

function loadScores() {
    const list = JSON.parse(localStorage.getItem("scoreboard") || "[]")

    if (list.length === 0) {
        scores_list.innerHTML = "<p>No scores yet.</p>"
        return
    }

    scores_list.innerHTML = ""

    list.forEach(entry => {
        const div = document.createElement("div")
        div.classList.add("score_entry")
        div.textContent = `${entry.name} — Score: ${entry.score} — Time: ${entry.time}s`
        scores_list.append(div)
    })
}

scores_btn.addEventListener("click", () => {
    loadScores()
    showScreen("scores_screen")
})

return_from_scores.addEventListener("click", () => {
    showScreen("main_menu")
})

squares.forEach(sq => {
    sq.addEventListener("click", () => {
        console.log("CLICKED SQUARE", sq.dataset.stationId)

        if (!sq.dataset.stationId) return

        const stId = Number(sq.dataset.stationId)

        if (!last_drawn_card) {
            if (!current_line) return
            if (!isStationOnCurrentLine(stId)) return
            if (!isEndpoint(stId)) return

            current_endpoint_id = stId
            highlightEndpoint()
            return
        }

        const dest = stations.find(s => s.id == stId)
        if (!dest) return

        const ok = last_valid_targets.some(s => s.id === dest.id)
        if (!ok) return

        const start = stations.find(s => s.id === current_endpoint_id)
        if (!start) return

        if (segmentCrosses(start, dest)) {
            return
        }

        segments.push({
            start: start.id,
            end: dest.id,
            color: current_line.color
        })

        lineStations[current_line.color].add(start.id)
        lineStations[current_line.color].add(dest.id)
        if (dest.train) railwayTouchCount++


        connectStations(start, dest, current_line.color)
        current_endpoint_id = dest.id
        highlightEndpoint()

        last_drawn_card = null
        last_valid_targets = []
        current_card.textContent = "Please draw a card!"
        squares.forEach(s => s.classList.remove("highlight"))

        if (drawn_cards_this_round === 8)
            endRound()
    })
})
