import { Card, TILE_WIDTH } from "./card";
import { Entity } from "./engine/entity";
import { Mouse } from "./engine/mouse";
import { Tile } from "./tile";

export class Hand extends Entity {
    private cards: Card[] = [];

    constructor(private board: Tile[]) {
        super(360, 500, 0, 0);
        this.add();
    }

    public add(): void {
        this.cards.push(new Card(this.position.x, this.position.y, this.board, this))
    }

    public update(tick: number, mouse: Mouse): void {
        this.cards.forEach(c => c.update(tick, mouse));
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        this.cards.forEach(c => c.draw(ctx));
    }
}