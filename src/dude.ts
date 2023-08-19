import { Gem, TILE_HEIGHT, TILE_WIDTH } from "./card";
import { drawCircle, drawEllipse } from "./engine/drawing";
import { Entity } from "./engine/entity";
import { Mouse } from "./engine/mouse";
import { RectParticle } from "./engine/rect";
import { Game } from "./game";
import { Level } from "./level";
import { Tile } from "./tile";

export class Dude extends Entity {
    public isMoving: boolean;

    private path: Tile[] = [];
    private phase = 0;

    constructor(private tile: Tile) {
        const p = tile.getPosition();
        super(p.x, p.y, TILE_WIDTH, TILE_HEIGHT);
        this.d = 50;
    }

    public reset(tile: Tile): void {
        const p = tile.getPosition();
        this.tile = tile;
        this.p = { x: p.x, y: p.y };
    }

    public update(tick: number, mouse: Mouse): void {
        this.tween.update(tick);
        this.phase = Math.abs(Math.sin(tick * 0.005));
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        const center = {
            x: this.p.x + this.s.x * 0.5, 
            y: this.p.y + this.s.y * 0.5
        };
        const head = {
            x: this.p.x + this.s.x * 0.5, 
            y: this.p.y + this.s.y * 0.5 - 30 - 5 * this.phase
        };
        ctx.save();
        ctx.translate(0, Math.sin(-this.tween.time * Math.PI) * 25);
        drawEllipse(ctx, center, 24, 12, "#00000033");
        drawCircle(ctx, head, 14, "#000");
        ctx.beginPath();
        ctx.moveTo(center.x, this.p.y - 10 - 5 * this.phase);
        ctx.lineTo(center.x + 14, this.p.y + 32);
        ctx.lineTo(center.x, this.p.y + 34);
        ctx.lineTo(center.x - 14, this.p.y + 32);
        ctx.fill();
        drawCircle(ctx, head, 8, "#fff");
        ctx.beginPath();
        ctx.moveTo(center.x, this.p.y - 2 - 5 * this.phase);
        ctx.lineTo(center.x + 6, this.p.y + 26);
        ctx.lineTo(center.x, this.p.y + 28);
        ctx.lineTo(center.x - 6, this.p.y + 26);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y + 5);
        ctx.lineTo(head.x, head.y - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(head.x - 4, head.y - 2 * this.phase);
        ctx.lineTo(head.x + 4, head.y - 2 * this.phase);
        ctx.stroke();
        ctx.restore();
    }

    public findPath(to: Tile, game: Game, level: Level): void {
        this.path = [];
        this.findNext(this.tile, to, [this.tile]);
        this.tile = this.path[this.path.length - 1];
        this.isMoving = true;
        const moveDuration = 0.3;
        this.path.forEach((tile, index) => {
            setTimeout(() => {
                tile.content.visited = true;

                if(index > 0) {
                    this.tween.move(tile.getPosition(), moveDuration);

                    setTimeout(() => {
                        game.audio.move();
                        const p = tile.getCenter();
                        for(let i = 0; i < 10; i++) {
                            const size = 1 + Math.random() * 3;
                            const opts = { force: { x: 0, y: 0.1 }, depth: 20, color: "#5b7c5b44" };
                            const v = { x: -2 + Math.random() * 4, y: -4 * Math.random() };
                            game.effects.add(new RectParticle(p.x, p.y, size, size, 0.2 + Math.random() * 0.5, v, opts));
                        }
                    }, moveDuration * 0.25);
                    tile.content.activate();
                    tile.content.pop(index * game.stepScore);
                    game.loot(tile);

                    if(game.remoteMulti) {
                        const neighbours = tile.getNeighbours(level.board).filter(t => t.content && t.content.data.gem == Gem.Orange);
                        neighbours.forEach(n => n.content.activate());
                    }
                }
            }, index * moveDuration * 1000);
        });
        setTimeout(() => {
            this.path.forEach(p => p.content.visited = false);
            this.isMoving = false;
        }, (this.path.length + 1) * moveDuration * 1000);
        setTimeout(() => game.checkLevelEnd(), this.path.length * moveDuration * 1000 + 600);
    }

    private findNext(from: Tile, to: Tile, visited: Tile[]): void {
        const steps = from.content.getConnections().filter(tile => !visited.includes(tile));
        if(from == to) {
            if(this.path.length < visited.length) {
                this.path = [...visited];
            }
            return;
        }
        if(steps.length <= 0) return;
        steps.forEach(step => this.findNext(step, to, [...visited, step]));
    }
}