import { Draggable } from "./engine/draggable";
import { drawCircle } from "./engine/drawing";
import { Mouse } from "./engine/mouse";
import { Pulse } from "./engine/pulse";
import { random } from "./engine/random";
import { Vector, distance, normalize, offset } from "./engine/vector";
import { Game } from "./game";
import { HEIGHT, WIDTH } from "./index";
import { Level } from "./level";
import { TextEntity } from "./text";
import { Tile } from "./tile";

export const TILE_WIDTH = 80;
export const TILE_HEIGHT = 60;

export const CARD_BORDER = 7;
export const CARD_GAP = 2;

export const gemColors = [
    null,
    "#00BDE5",
    "#846AC1",
    "#E93988",
    "#F3DC00",
    "#F89F00",
    "#B4D000"
];

export const gemNames = [
    null,
    "FIBONACCI'S BOON",
    "PENANCE",
    "POPE'S BLESSING",
    "INDULGENCE",
    "DYNASTY",
    "KHAN'S LEGACY"
];

const gemDescriptions = [
    null,
    "|Draw extra| card when |placed|.",
    "|Recycle |random card when |stepping| on.",
    "|Heal| for one when |placed|.",
    "|Score earned| for stepping on is |tenfold|.",
    "|Doubles| move scores when |stepping| on.",
    "Fill neighbours with |blank cards|."
];

export enum Direction {
    Up,
    Right,
    Down,
    Left
};

export enum Gem {
    None,
    Blue,
    Purple,
    Red,
    Yellow,
    Orange,
    Green
};

export const getRandomGem = () => {
    return 1 + Math.floor(Math.random() * 5);
}

export interface CardData {
    directions: Direction[];
    gem: Gem;
}

export function randomCard(chance = 1, canHaveGem = true, dirs?: Direction[]): CardData {
    const count = Math.random() < 0.1 ? 4 : (1 + Math.floor(Math.random() * 3));
    const directions = dirs ?? [Direction.Up, Direction.Right, Direction.Down, Direction.Left].sort(() =>  Math.random() - 0.5).slice(0, count);
    const gemChance = directions.length == 1 ? 0.6 * chance : 0.2 * chance;
    return {
        directions,
        gem: canHaveGem && Math.random() < gemChance ? 1 + Math.floor(Math.random() * 6): Gem.None
    }
}

export class Card extends Draggable {
    public visited: boolean;

    private tile: Tile;

    public constructor(x: number, y: number, private level: Level, private game: Game, public data: CardData) {
        super(x, y, TILE_WIDTH, TILE_HEIGHT);
    }

    public is(color: Gem): boolean {
        return this.data.gem != Gem.None && [this.data.gem, ...this.game.getWilds(this.data.gem)].includes(color);
    }

    public isLocked(): boolean {
        return this.locked;
    }

    public makeSelectable(): void {
        this.lock();
        this.selectable = true;
    }

    public update(tick: number, mouse: Mouse): void {
        super.update(tick, mouse);
        const sorted = [...this.level.board]
            .filter(tile => !tile.content && tile.accepts(this, this.level.board) && distance(this.p, tile.getPosition()) < 100)
            .sort((a, b) => distance(this.p, a.getPosition()) - distance(this.p, b.getPosition()));

        const prev = this.tile;
        this.tile = sorted.length > 0 ? sorted[0]: null;
        if(this.tile && this.dragging) this.tile.hilite = true;
        if(prev && prev != this.tile) prev.hilite = false;
    }

    public move(to: Vector, duration: number): void {
        this.tween.move(to, duration);
    }

    public getMoveTarget(): Vector {
        return this.game.pile.getPosition();
    }
    
    public getPossibleSpots(): Tile[] {
        return this.level.board.filter(tile => !tile.content && tile.accepts(this, this.level.board))
    }

    protected click(): void {
        this.game.audio.pop();
        this.game.audio.swoosh();
        this.game.pick(this);
        this.game.tooltip.visible = false;
    }

    protected pick(): void {
        this.game.audio.click();
        this.getPossibleSpots().forEach(tile => tile.marked = true);
    }

    protected drop(): void {
        this.game.audio.pong();
        this.level.board.forEach(tile => tile.marked = false);
        this.level.board.filter(tile => tile.content === this).forEach(tile => tile.content = null);

        if(this.game.picker.rewards > 0) {
            this.move(this.getStartPosition(), 0.1);
            return;
        }

        if(this.game.dude.isMoving) console.log('blocking...');

        if(this.tile && !this.game.dude.isMoving) {
            this.game.multi = 1;
            this.locked = true;
            this.p = this.tile.getPosition();
            this.tile.content = this;
            this.game.fill();
            this.game.findPath(this.tile, this.game);
            if(this.is(Gem.Blue)) {
                this.game.audio.discard();
                this.game.pull();
            }
            if(this.is(Gem.Red)) {
                this.game.heal(1);
            }
            if(this.is(Gem.Green)) {
                const neighbours = this.tile.getFreeNeighbours(this.level.board, true).filter(n => !n.content);
                neighbours.forEach(n => this.game.createBlank(n));
                if(neighbours.length > 0) {
                    this.game.audio.open();
                    this.game.audio.aja();
                    this.pulse();
                }
            }
            return;
        }

        this.move(this.getStartPosition(), 0.1);
    }

    public exit(): void {
        if(this.data.gem) {
            this.game.tooltip.visible = false;
        }
    }

    public hover(): void {
        if(this.data.gem) {
            setTimeout(() => {
                this.game.tooltip.show(gemNames[this.data.gem], gemDescriptions[this.data.gem], offset(this.getCenter(), 0, -50 * this.scale.y), [gemColors[this.data.gem]]);
            }, 5);
        }
        this.game.audio.thud();
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        const c = this.getCenter();
        ctx.translate(c.x, c.y);
        ctx.scale(this.scale.x, this.scale.y);
        ctx.translate(-c.x, -c.y);
        if(this.hovered && this.selectable) {
            ctx.translate(0, -10);
        }
        if(this.dragging) {
            ctx.fillStyle = "#00000022";
            const center =  { x: WIDTH * 0.5, y: HEIGHT * 0.5 };
            const p = {
                x: this.p.x + CARD_GAP,
                y: this.p.y + CARD_GAP
            };
            const dir = normalize({ x: p.x - center.x, y: p.y - center.y });
            ctx.fillRect(p.x + dir.x * 12, p.y + dir.y * 24, this.s.x - CARD_GAP * 2, this.s.y - CARD_GAP * 2);
        }
        
        ctx.fillStyle = "#000";
        ctx.fillRect(this.p.x + CARD_GAP, this.p.y + CARD_GAP, this.s.x - CARD_GAP * 2, this.s.y - CARD_GAP * 2);
        ctx.fillStyle = this.hovered && (!this.locked || this.selectable) ? "#ffff66" : "#fff";
        if(this.visited) ctx.fillStyle = "#ffffaa";
        ctx.fillRect(this.p.x + CARD_BORDER + CARD_GAP, this.p.y + CARD_BORDER + CARD_GAP, this.s.x - CARD_BORDER * 2 - CARD_GAP * 2, this.s.y - CARD_BORDER * 2 - CARD_GAP * 2);

        if(this.data.directions.includes(Direction.Up)) {
            this.lineTo(ctx, this.p.x + this.s.x * 0.5, this.p.y + CARD_BORDER + CARD_GAP);
        }
        if(this.data.directions.includes(Direction.Right)) {
            this.lineTo(ctx, this.p.x + this.s.x - CARD_BORDER - CARD_GAP, this.p.y + this.s.y * 0.5);
        }
        if(this.data.directions.includes(Direction.Down)) {
            this.lineTo(ctx, this.p.x + this.s.x * 0.5, this.p.y + this.s.y - CARD_BORDER - CARD_GAP);
        }
        if(this.data.directions.includes(Direction.Left)) {
            this.lineTo(ctx, this.p.x + CARD_BORDER + CARD_GAP, this.p.y + this.s.y * 0.5);
        }

        const p = {
            x: this.p.x + this.s.x * 0.5,
            y: this.p.y + this.s.y * 0.5
        };

        if(this.data.directions.length > 0) {
            drawCircle(ctx, p, 8, "#000");
        }

        if(this.data.gem) {
            drawCircle(ctx, p, 12, "#000");
            drawCircle(ctx, p, 6, gemColors[this.data.gem]);
        }

        ctx.restore();
    }

    public lock(): void {
        this.d = -50;
        this.locked = true;
    }

    public has(dir: Direction): boolean {
        return this.data.directions && this.data.directions.includes(dir);
    }

    public getConnections(): Tile[] {
        const index = this.level.board.find(tile => tile.content === this).index;
        return this.data.directions.map(d => {
            if(d == Direction.Up) return this.level.board.find(tile => tile.index.x === index.x && tile.index.y === index.y - 1 && tile.content && tile.content.has(Direction.Down));
            if(d == Direction.Down) return this.level.board.find(tile => tile.index.x === index.x && tile.index.y === index.y + 1 && tile.content && tile.content.has(Direction.Up));
            if(d == Direction.Left) return this.level.board.find(tile => tile.index.x === index.x - 1 && tile.index.y === index.y && tile.content && tile.content.has(Direction.Right));
            if(d == Direction.Right) return this.level.board.find(tile => tile.index.x === index.x + 1 && tile.index.y === index.y && tile.content && tile.content.has(Direction.Left));
        }).filter(tile => tile && tile.content);
    }

    public activate(): void {
        if(this.is(Gem.Red) && this.game.healOnStep) {
            this.game.heal(1);
        }
        if(this.is(Gem.Purple)) {
            this.game.audio.discard();
            this.game.discard();
        }
        if(this.is(Gem.Orange)) {
            this.triggerMulti();
        }
        if(this.is(Gem.Yellow)) {
            this.game.audio.score();
        }
    }

    public triggerMulti(): void {
        this.game.audio.multi();
        this.game.multi *= 2;
        this.popText(`x${this.game.multi}`, {
            x: this.p.x + this.s.x * 0.5,
            y: this.p.y + this.s.y * 0.5 - 50
        }, gemColors[Gem.Orange]);
    }

    public pop(amt: number): void {
        setTimeout(() => {
            this.game.camera.shake(3, 0.08);
            this.addScore(amt);
        }, 0.2);
    }

    private addScore(amt: number, ): void {
        const isYellow = this.is(Gem.Yellow);
        const addition = this.getScore(amt);
        this.game.score += addition;
        const p = {
            x: this.p.x + this.s.x * 0.5,
            y: this.p.y + this.s.y * 0.5 - 20
        };
        this.pulse();
        this.popText(addition.toString(), p, isYellow ? gemColors[Gem.Yellow] : "#fff");
    }

    public pulse(): void {
        const c = this.getCenter();
        this.game.effects.add(new Pulse(c.x, c.y, 40 + Math.random() * 30, 1, 10, 60));
    }

    private popText(content: string, p: Vector, color: string): void {
        this.game.effects.add(new TextEntity(
            content,
            40 + Math.random() * 10,
            p.x,
            p.y,
            0.5 + Math.random(),
            { x: 0, y: -1 - Math.random() },
            { shadow: 4, align: "center", scales: true, color, angle: random(-0.1, 0.1) }
        ));
    }

    private lineTo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        ctx.beginPath();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 7;
        ctx.moveTo(this.p.x + this.s.x * 0.5, this.p.y + this.s.y * 0.5);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    public getScore(step: number): number {
        const mod = this.is(Gem.Yellow) ? 10 : 1;
        return step * mod * this.game.multi * this.level.level;
    }
}

export function drawCorners(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.strokeStyle = "#00000022";
    ctx.lineWidth = 4;
    ctx.lineDashOffset = 5;
    ctx.setLineDash([10, 40, 10, 20, 10, 40, 10, 20]);
    ctx.strokeRect(x + 15, y + 15, TILE_WIDTH - 30, TILE_HEIGHT - 30);
    ctx.setLineDash([]);
}