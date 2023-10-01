import { kv } from "./index.ts"

export const generateId = (length: number) => {
  let result = ""
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz"
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function calculateWinner(input: { [key: string]: string }) {
  function player1Wins(choice1: string, choice2: string) {
    return (
      (choice1 === "rock" && choice2 === "scissor") ||
      (choice1 === "paper" && choice2 === "rock") ||
      (choice1 === "scissor" && choice2 === "paper")
    );
  }
  if (input[Object.keys(input)[0]] === input[Object.keys(input)[1]]) {
    return "tie";
  } else if (player1Wins(input[Object.keys(input)[0]], input[Object.keys(input)[1]])) {
    return Object.keys(input)[0];
  } else {
    return Object.keys(input)[1];
  }
}

export const getCurrentRoomData = async (id: string) => {
  const data = await kv.get<GameState>(["rooms", id])
  return data.value!
}

export interface GameState {
  id: string
  players: Player[]
  state: "waiting" | "started"
  records?: RoundRecord[] | undefined
  currentRound?:
  | {
    choices?:
    | {
      [key: string]: Choice
    }
    | undefined
    winner?: string | undefined
  }
  | undefined
}

interface RoundRecord {
  winner: string
}

export interface Player {
  socketid: string
  name: string
  avatar: string
  email: string
}

export type Choice = "rock" | "paper" | "scissor"
