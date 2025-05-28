// schema/ChessRoomState.ts
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class PieceState extends Schema {
  @type("string") type: string = "";
  @type("string") color: "white" | "black" = "white";
  @type("number") row: number = 0;
  @type("number") col: number = 0;
  @type("boolean") hasMoved: boolean = false;
}

export class PlayerState extends Schema {
  @type("string") sessionId: string = "";
  @type("string") color: "white" | "black" | "spectator" = "spectator";
  @type("string") name: string = "";
  @type("boolean") connected: boolean = true;
}

export class ChessRoomState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([PieceState]) pieces = new ArraySchema<PieceState>();
  @type("string") currentTurn: "white" | "black" = "white";
  @type("string") gameStatus: "waiting" | "playing" | "finished" = "waiting";
  @type("string") winner: string = "";
  @type("number") lastMoveTime: number = 0;
  @type("boolean") gameStarted: boolean = false;

  // Selected piece info for UI synchronization
  @type("string") selectedPiecePlayer: string = "";
  @type("number") selectedRow: number = -1;
  @type("number") selectedCol: number = -1;
}