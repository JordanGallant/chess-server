// ChessRoom.ts
import { Room, Client } from "@colyseus/core";
import { ChessRoomState, PlayerState, PieceState } from "./schema/ChessRoomState";

interface MoveMessage {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

interface SelectMessage {
  row: number;
  col: number;
}

export class ChessRoom extends Room<ChessRoomState> {
  maxClients = 2; // 2
  state = new ChessRoomState();

  onCreate(options: any) {
    console.log("Chess room created!");

    // Initialize the chess board
    this.initializeBoard();

    // Handle player moves
    this.onMessage("move", (client, message: MoveMessage) => {
      this.handleMove(client, message);
    });

    // Handle piece selection
    this.onMessage("select", (client, message: SelectMessage) => {
      this.handleSelection(client, message);
    });

    // Handle deselection
    this.onMessage("deselect", (client) => {
      this.handleDeselection(client);
    });

    // Handle game restart
    this.onMessage("restart", (client) => {
      this.handleRestart(client);
    });

    // Handle player ready
    this.onMessage("ready", (client) => {
      this.handlePlayerReady(client);
    });
  }

onJoin(client: Client, options: any) {
  console.log(client.sessionId, "joined chess room!");

  const player = new PlayerState();
  player.sessionId = client.sessionId;
  player.name = options.name || `Player ${client.sessionId.substr(0, 6)}`;

  // Count existing players BEFORE adding the new one
 const existingPlayerCount = this.state.players.size;
  
  console.log(`Player joining. Existing players: ${existingPlayerCount}`); // Debug log

  // Assign colors to first two players
  if (existingPlayerCount === 0) {
    player.color = "white";
    console.log("Assigned white to first player");
  } else if (existingPlayerCount === 1) {
    player.color = "black";
    console.log("Assigned black to second player");
    // Start game when second player joins
    this.state.gameStatus = "playing";
    this.state.gameStarted = true;
    console.log("Game started!");
  } else {
    player.color = "spectator";
    console.log("Assigned spectator to additional player");
  }

  // Add player to the room
  this.state.players.set(client.sessionId, player);

  // Send initial game state to client
  client.send("gameState", {
    color: player.color,
    gameStatus: this.state.gameStatus,
    currentTurn: this.state.currentTurn
  });

  // Broadcast player joined to all clients
  this.broadcast("playerJoined", {
    sessionId: client.sessionId,
    name: player.name,
    color: player.color,
    totalPlayers: Object.keys(this.state.players).length
  });
}

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left chess room!");

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;

      // If a playing player leaves, pause the game
      if (player.color !== "spectator" && this.state.gameStatus === "playing") {
        this.state.gameStatus = "waiting";
        this.broadcast("playerDisconnected", { color: player.color });
      }
    }

    // Remove player after a delay in case they reconnect
    setTimeout(() => {
      this.state.players.delete(client.sessionId);
    }, 30000); // 30 seconds
  }

  onDispose() {
    console.log("Chess room disposing...");
  }

  private initializeBoard() {
    this.state.pieces.clear();

    // Place pawns
    for (let col = 1; col < 9; col++) {
      // Black pawns
      const blackPawn = new PieceState();
      blackPawn.type = "pawn";
      blackPawn.color = "black";
      blackPawn.row = 1;
      blackPawn.col = col;
      this.state.pieces.push(blackPawn);

      // White pawns
      const whitePawn = new PieceState();
      whitePawn.type = "pawn";
      whitePawn.color = "white";
      whitePawn.row = 6;
      whitePawn.col = col;
      this.state.pieces.push(whitePawn);
    }

    // Place other pieces with Mann on the outside
    const pieceTypes = ["mann", "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook", "mann"];

    for (let col = 0; col < 10; col++) {
      // Black pieces
      const blackPiece = new PieceState();
      blackPiece.type = pieceTypes[col];
      blackPiece.color = "black";
      blackPiece.row = 0;
      blackPiece.col = col;
      this.state.pieces.push(blackPiece);

      // White pieces
      const whitePiece = new PieceState();
      whitePiece.type = pieceTypes[col];
      whitePiece.color = "white";
      whitePiece.row = 7;
      whitePiece.col = col;
      this.state.pieces.push(whitePiece);
    }
  }

  private handleMove(client: Client, message: MoveMessage) {
    const player = this.state.players.get(client.sessionId);

    // Validate player and turn
    if (!player || player.color === "spectator" ||
      this.state.currentTurn !== player.color ||
      this.state.gameStatus !== "playing") {
      client.send("error", { message: "Invalid move attempt" });
      return;
    }

    // Find the piece to move
    const pieceIndex = this.state.pieces.findIndex(p =>
      p.row === message.fromRow && p.col === message.fromCol && p.color === player.color
    );

    if (pieceIndex === -1) {
      client.send("error", { message: "No piece found at source position" });
      return;
    }

    // Validate move (you'd implement full chess logic here)
    if (!this.isValidMove(message)) {
      client.send("error", { message: "Invalid move" });
      return;
    }

    // Check for capture
    const capturedIndex = this.state.pieces.findIndex(p =>
      p.row === message.toRow && p.col === message.toCol
    );

    if (capturedIndex !== -1) {
      this.state.pieces.splice(capturedIndex, 1);
    }

    // Move the piece
    const piece = this.state.pieces[pieceIndex];
    piece.row = message.toRow;
    piece.col = message.toCol;
    piece.hasMoved = true;

    // Switch turns
    this.state.currentTurn = this.state.currentTurn === "white" ? "black" : "white";
    this.state.lastMoveTime = Date.now();

    // Clear selection
    this.state.selectedPiecePlayer = "";
    this.state.selectedRow = -1;
    this.state.selectedCol = -1;

    // Broadcast move to all clients
    this.broadcast("moveExecuted", {
      from: { row: message.fromRow, col: message.fromCol },
      to: { row: message.toRow, col: message.toCol },
      player: player.color,
      currentTurn: this.state.currentTurn
    });
  }

  private handleSelection(client: Client, message: SelectMessage) {
    const player = this.state.players.get(client.sessionId);

    if (!player || player.color === "spectator" ||
      this.state.currentTurn !== player.color) {
      return;
    }

    // Find piece at position
    const piece = this.state.pieces.find(p =>
      p.row === message.row && p.col === message.col && p.color === player.color
    );

    if (piece) {
      this.state.selectedPiecePlayer = client.sessionId;
      this.state.selectedRow = message.row;
      this.state.selectedCol = message.col;

      this.broadcast("pieceSelected", {
        row: message.row,
        col: message.col,
        player: player.color
      });
    }
  }

  private handleDeselection(client: Client) {
    const player = this.state.players.get(client.sessionId);

    if (player && this.state.selectedPiecePlayer === client.sessionId) {
      this.state.selectedPiecePlayer = "";
      this.state.selectedRow = -1;
      this.state.selectedCol = -1;

      this.broadcast("pieceDeselected", {
        player: player.color
      });
    }
  }

  private handleRestart(client: Client) {
    const player = this.state.players.get(client.sessionId);

    // Only allow players (not spectators) to restart
    if (!player || player.color === "spectator") {
      return;
    }

    this.initializeBoard();
    this.state.currentTurn = "white";
    this.state.gameStatus = "playing";
    this.state.winner = "";
    this.state.selectedPiecePlayer = "";
    this.state.selectedRow = -1;
    this.state.selectedCol = -1;

    this.broadcast("gameRestarted");
  }

  private handlePlayerReady(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player && this.state.gameStatus === "waiting") {
      client.send("gameReady");
    }
  }

  private isValidMove(message: MoveMessage): boolean {
    // This is a simplified validation - you'd implement full chess logic here
    // For now, just check if the destination is different from source
    return !(message.fromRow === message.toRow && message.fromCol === message.toCol);
  }
}