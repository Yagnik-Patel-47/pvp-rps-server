import { serve } from "https://deno.land/std@0.150.0/http/server.ts"
import { Server, Socket } from "https://deno.land/x/socket_io@0.2.0/mod.ts"
import { initGame } from "./game.ts"
import { GameState } from "./lib.ts";

export const kv = await Deno.openKv();

const io = new Server({
  cors: {
    origin: ["http://localhost:5173"],
    credentials: true,
  },
})

io.on("connection", (socket) => {
  socket.on("initGame", () => {
    initGame(io, socket)
  })

  socket.on("joinGame", () => {
    initGame(io, socket)
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

await serve(io.handler(), {
  port: 3000,
})
