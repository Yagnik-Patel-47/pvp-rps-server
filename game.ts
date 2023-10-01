import type { Server, Socket } from "https://deno.land/x/socket_io@0.2.0/mod.ts"
import { kv } from "./index.ts"
import {
  generateId,
  GameState,
  Player,
  Choice,
  getCurrentRoomData,
  calculateWinner,
} from "./lib.ts"

export function initGame(sio: Server, socket: Socket) {
  const io = sio
  const gameSocket = socket
  let roomId = ""

  // Host Events
  gameSocket.on("createLobby", createLobby)
  gameSocket.on("finishExchangeData", exchangeData)

  // Player Events
  gameSocket.on("joinGame", playerJoin)
  gameSocket.on("choiceSelected", saveAndBrodcastResult)

  // Common Events
  gameSocket.on("setGameState", setGameState)
  gameSocket.on("lobbyToGame", createGameRoom)
  gameSocket.on("announceLeave", destroyRoom)

  // Event Functions
  function createLobby(this: Socket, data: Player) {
    const thisGameId = generateId(5)
    roomId = thisGameId
    this.join(`lobby:${thisGameId}`)
    kv.set(
      ["rooms", thisGameId],
      {
        id: thisGameId,
        players: [data],
        state: "waiting",
      },
      { expireIn: 1000 * 60 * 30 }
    )
    this.emit("getRoomData", {
      id: thisGameId,
      players: [data],
      state: "waiting",
    })
  }

  async function playerJoin(this: Socket, roomCode: string, data: Player) {
    roomId = roomCode
    const { value: room } = await kv.get<GameState>(["rooms", roomCode]);
    if (room) {
      if (room.players.length > 1) {
        socket.emit("roomIsFull");
        return;
      }
      if (room.state === "started") {
        socket.emit("roomIsStarted");
        return;
      }
    }
    // @ts-ignore: Type is wrong maybe. It's saying property 'rooms' is protected and only accessible within class 'InMemoryAdapter' and its subclasses, but it is still accessible.
    if (io.of("/").adapter.rooms.has(`lobby:${roomCode}`)) {
      this.join(`lobby:${roomCode}`)
      this.emit("getRoomData", {
        id: roomCode,
        players: [data],
        state: "waiting",
      })
      this.to(`lobby:${roomCode}`).emit("exchangeData", data)
    } else {
      this.emit("roomNotFound")
    }
  }

  async function saveAndBrodcastResult(this: Socket, choice: Choice) {
    const gState = await getCurrentRoomData(roomId)
    const gameState = {
      ...gState,
      currentRound: {
        choices: gState.currentRound?.choices
          ? {
            ...gState.currentRound.choices,
            [this.id]: choice,
          }
          : {
            [this.id]: choice,
          },
      },
    }
    await kv.set(["rooms", roomId], gameState)
    if (Object.keys(gameState.currentRound.choices).length === 2) {
      const winner = calculateWinner(gameState.currentRound.choices)
      const roundResultState = {
        ...gameState,
        currentRound: {
          choices: gameState.currentRound.choices,
          winner,
        },
        records: gameState.records
          ? [...gameState.records, { winner }]
          : [{ winner }],
      }
      await kv.set(["rooms", roomId], roundResultState)
      io.to(`game:${roomId}`).emit("announceWinner", roundResultState)
      setTimeout(async () => {
        await kv.set(["rooms", roomId], {
          ...roundResultState,
          currentRound: undefined,
        })
        io.to(`game:${roomId}`).emit("selectChoice")
      }, 3000)
    }
  }

  async function exchangeData(this: Socket) {
    const gameState = await getCurrentRoomData(roomId)
    setTimeout(() => {
      this.to(`lobby:${roomId}`).emit("exchangeData", gameState.players[0])
    }, 500)
    setTimeout(() => {
      io.in(`lobby:${roomId}`).emit("prepareRound1")
    }, 2000)
  }

  function createGameRoom(this: Socket) {
    this.leave(`lobby:${roomId}`)
    this.join(`game:${roomId}`)
    setTimeout(() => {
      io.to(`game:${roomId}`).emit("selectChoice")
    }, 500)
  }

  async function destroyRoom(this: Socket, roomId: string) {
    this.to(`game:${roomId}`).emit("oppLeftGame");
    this.leave(`game:${roomId}`);
    await kv.delete(["rooms", roomId]);
  }

  async function setGameState(newGameState: GameState) {
    await kv.set(["rooms", roomId], newGameState)
  }
}
