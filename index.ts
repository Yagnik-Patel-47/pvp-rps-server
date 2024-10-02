import { Server, type Socket } from "npm:socket.io"
import { initGame } from "./game.ts"
import { GameState } from "./lib.ts";

export const kv = await Deno.openKv();

const io = new Server({
  cors: {
    origin: ["http://localhost:5173", "https://pvp-rps.vercel.app"],
    credentials: true
  }
})

io.on("connection", (socket) => {
  socket.on("initGame", () => {
    initGame(io, socket)
  })

  socket.on("joinGame", () => {
    initGame(io, socket)
  })

  socket.on("cleanRooms", async () => {
    const rooms = kv.list<GameState>({ prefix: ["rooms"] });
    for await (const room of rooms) {
      await kv.delete(["rooms", room.value.id])
    }
  })

  socket.on("getRooms", async function (this: Socket) {
    const res = []
    const rooms = kv.list<GameState>({ prefix: ["rooms"] })
    for await (const room of rooms) {
      res.unshift({ id: room.value.id, status: room.value.state })
    }
    this.emit("sendRooms", res);
  });

  socket.on("disconnecting", () => {
    const removingRooms = [...socket.rooms];
    removingRooms.shift();
    socket.to(removingRooms).emit("oppLeftGame")
    removingRooms.forEach(async room => {
      const roomId = room.toString().split(":")[1];
      await kv.delete(["rooms", roomId])
    })
  });
})

const PORT = 8000

io.listen(PORT)
console.log(`listening on port ${PORT}`);

