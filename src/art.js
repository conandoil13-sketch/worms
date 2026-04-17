export function generateHexFromTime(time) {
    const seed = Math.sin(time) * 10000;
    const r = Math.floor((seed - Math.floor(seed)) * 256);
    const g = Math.floor(((seed * 1.5) - Math.floor(seed * 1.5)) * 256);
    const b = Math.floor(((seed * 2.0) - Math.floor(seed * 2.0)) * 256);

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function blendNumber(a, b, ratio) {
    return a + (b - a) * ratio;
}

function shiftChannel(channel, delta) {
    return clamp(channel + delta, 0, 255);
}

function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16)
    };
}

function rgbToHex({ r, g, b }) {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function mixHex(a, b, ratio) {
    const first = hexToRgb(a);
    const second = hexToRgb(b);
    return rgbToHex({
        r: Math.round(blendNumber(first.r, second.r, ratio)),
        g: Math.round(blendNumber(first.g, second.g, ratio)),
        b: Math.round(blendNumber(first.b, second.b, ratio))
    });
}

function mutateHex(hex, delta) {
    const rgb = hexToRgb(hex);
    return rgbToHex({
        r: Math.round(shiftChannel(rgb.r, delta)),
        g: Math.round(shiftChannel(rgb.g, -delta * 0.5)),
        b: Math.round(shiftChannel(rgb.b, delta * 0.35))
    });
}

function drawSigilBackground(ctx, palette, glow) {
    const background = ctx.createRadialGradient(384, 384, 40, 384, 384, 360);
    background.addColorStop(0, mixHex(palette[2], "#000000", 0.55));
    background.addColorStop(0.65, mixHex(palette[1], "#040404", 0.88));
    background.addColorStop(1, "#010101");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 768, 768);

    ctx.save();
    ctx.globalAlpha = 0.08 + glow * 0.08;
    for (let i = 0; i < 28; i += 1) {
        const angle = (Math.PI * 2 * i) / 28;
        const x = 384 + Math.cos(angle) * 310;
        const y = 384 + Math.sin(angle) * 310;
        ctx.strokeStyle = palette[i % palette.length];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(384, 384);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawArtifactTexture(ctx, palette) {
    ctx.save();

    for (let i = 0; i < 140; i += 1) {
        const x = (i * 53) % 768;
        const y = (i * 97) % 768;
        const w = 40 + (i % 7) * 12;
        const h = 1 + (i % 3);
        ctx.globalAlpha = 0.03 + (i % 5) * 0.008;
        ctx.fillStyle = i % 3 === 0 ? palette[2] : "#d9c27a";
        ctx.fillRect(x, y, w, h);
    }

    ctx.globalAlpha = 0.045;
    for (let y = 0; y < 768; y += 3) {
        ctx.fillStyle = y % 9 === 0 ? palette[1] : "#000000";
        ctx.fillRect(0, y, 768, 1);
    }

    ctx.restore();
}

function drawOccultHalo(ctx, palette, glow) {
    ctx.save();
    const halo = ctx.createRadialGradient(384, 384, 60, 384, 384, 250);
    halo.addColorStop(0, mixHex(palette[0], "#ffffff", 0.5));
    halo.addColorStop(0.35, mixHex(palette[2], "#0d0d0d", 0.25));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.2 + glow * 0.18;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(384, 384, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawGenerationRings(ctx, genome, generation) {
    ctx.save();
    const ringCount = Math.max(2, Math.min(7, (genome.ringCount ?? 3) + Math.floor((generation - 1) / 2)));
    for (let i = 0; i < ringCount; i += 1) {
        const radius = 88 + i * 54;
        ctx.globalAlpha = 0.18 + i * 0.05;
        ctx.strokeStyle = i % 2 === 0 ? "#d9c27a" : genome.palette[i % genome.palette.length];
        ctx.lineWidth = 2 + (i % 2) * 1.5;
        ctx.beginPath();
        ctx.arc(384, 384, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.08;
        ctx.setLineDash([2, 12 + i * 2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(384, 384, radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.restore();
}

function drawCoreSigil(ctx, genome, metrics) {
    const sigilSides = genome.symmetry;
    const scoreFactor = clamp((metrics.score ?? 0) / 450, 0, 1);
    const lengthFactor = clamp((metrics.length ?? 0) / 30, 0, 1);
    const radius = 72 + lengthFactor * 84;

    ctx.save();
    ctx.translate(384, 384);

    for (let ring = 0; ring < 3; ring += 1) {
        ctx.save();
        ctx.rotate((Math.PI / sigilSides) * ring * 0.55 + genome.turbulence * 0.3);
        ctx.beginPath();
        for (let i = 0; i <= sigilSides; i += 1) {
            const angle = (Math.PI * 2 * i) / sigilSides;
            const pulse = 1 + Math.sin(i * 1.7 + ring + scoreFactor * 4) * genome.turbulence * 0.75;
            const x = Math.cos(angle) * radius * pulse * (1 + ring * 0.18);
            const y = Math.sin(angle) * radius * pulse * (1 + ring * 0.18);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.strokeStyle = ring === 1 ? "#f4e6b3" : genome.palette[ring % genome.palette.length];
        ctx.lineWidth = genome.strokeWeight + ring * 1.2;
        ctx.globalAlpha = 0.92 - ring * 0.14;
        ctx.stroke();

        ctx.strokeStyle = mixHex("#ffffff", genome.palette[2], 0.35);
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.55;
        ctx.stroke();
        ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f4e6b3";
    ctx.beginPath();
    ctx.arc(0, 0, 14 + scoreFactor * 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = genome.palette[0];
    ctx.beginPath();
    ctx.arc(0, 0, 28 + scoreFactor * 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = mixHex(genome.palette[0], "#ffffff", 0.35);
    for (let i = 0; i < sigilSides; i += 1) {
        const angle = (Math.PI * 2 * i) / sigilSides;
        const outerX = Math.cos(angle) * (radius + 40 + scoreFactor * 20);
        const outerY = Math.sin(angle) * (radius + 40 + scoreFactor * 20);
        const innerX = Math.cos(angle) * 28;
        const innerY = Math.sin(angle) * 28;
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();
    }

    ctx.strokeStyle = "#f4e6b3";
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < sigilSides; i += 1) {
        const angle = (Math.PI * 2 * i) / sigilSides + Math.PI / sigilSides;
        const runeRadius = radius + 70 + lengthFactor * 26;
        const x = Math.cos(angle) * runeRadius;
        const y = Math.sin(angle) * runeRadius;
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 10);
        ctx.lineTo(x, y - 10);
        ctx.lineTo(x + 8, y + 10);
        ctx.stroke();
    }
    ctx.restore();
}

function drawRoomConstellation(ctx, rooms, palette) {
    if (!rooms?.length) {
        return;
    }

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = palette[1];
    ctx.fillStyle = palette[2];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    rooms.forEach((room, index) => {
        const x = (room.cx / 60) * 768;
        const y = (room.cy / 40) * 768;
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    rooms.forEach((room) => {
        const x = (room.cx / 60) * 768;
        const y = (room.cy / 40) * 768;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawPathRelic(ctx, path, genome) {
    if (!path?.length) {
        return;
    }

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = 20;
    ctx.shadowColor = genome.palette[0];

    const stride = Math.max(1, Math.floor(path.length / 90));
    for (let i = stride; i < path.length; i += stride) {
        const prev = path[i - 1];
        const curr = path[i];
        const hue = i % 5 === 0 ? "#d9c27a" : genome.palette[i % genome.palette.length];
        const alpha = 0.1 + (i / path.length) * 0.32;
        ctx.strokeStyle = hue;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = genome.strokeWeight * 0.8 + (i / path.length) * 5;
        ctx.beginPath();
        ctx.moveTo((prev.x / 60) * 768, (prev.y / 40) * 768);
        ctx.lineTo((curr.x / 60) * 768, (curr.y / 40) * 768);
        ctx.stroke();
    }
    ctx.restore();
}

function drawAppleMarks(ctx, apples, palette) {
    if (!apples?.length) {
        return;
    }

    ctx.save();
    const limited = apples.slice(-8);
    limited.forEach((apple, index) => {
        const x = (apple.x / 60) * 768;
        const y = (apple.y / 40) * 768;
        const size = 8 + (index % 3) * 3;
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = index % 2 === 0 ? "#f4e6b3" : palette[index % palette.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();

        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(x, y, size + 8, 0, Math.PI * 2);
        ctx.stroke();
    });
    ctx.restore();
}

function drawDeathSeal(ctx, deathPoint, palette) {
    if (!deathPoint) {
        return;
    }

    const x = (deathPoint.x / 60) * 768;
    const y = (deathPoint.y / 40) * 768;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = palette[1];
    ctx.fillStyle = mixHex(palette[0], "#ffffff", 0.25);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 18);
    ctx.lineTo(x + 18, y + 18);
    ctx.moveTo(x + 18, y - 18);
    ctx.lineTo(x - 18, y + 18);
    ctx.stroke();
    ctx.restore();
}

function drawFrame(ctx, palette) {
    ctx.save();
    ctx.strokeStyle = "#d9c27a";
    ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, 720, 720);
    ctx.lineWidth = 2;
    ctx.strokeStyle = palette[2];
    ctx.strokeRect(40, 40, 688, 688);
    ctx.globalAlpha = 0.22;
    ctx.setLineDash([18, 12]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f4e6b3";
    ctx.strokeRect(56, 56, 656, 656);
    ctx.setLineDash([]);
    ctx.restore();
}

export function createGenome({ startCol, endCol, length, score, time, parentGenome = null }) {
    const timeFactor = clamp(time / 60000, 0, 1);
    const scoreFactor = clamp(score / 600, 0, 1);
    const lengthFactor = clamp(length / 35, 0, 1);
    const basePalette = parentGenome?.palette ?? [startCol, endCol, mixHex(startCol, endCol, 0.5)];
    const mutationDelta = Math.round((scoreFactor - 0.5) * 60);
    const palette = [
        mixHex(basePalette[0], startCol, 0.4 + scoreFactor * 0.3),
        mixHex(basePalette[1], endCol, 0.4 + lengthFactor * 0.3),
        mutateHex(mixHex(startCol, endCol, 0.5), mutationDelta)
    ];

    return {
        palette,
        symmetry: Math.max(3, Math.min(10, Math.round(blendNumber(parentGenome?.symmetry ?? 4, 3 + Math.floor(score / 35) % 6, 0.45)))),
        density: Number(blendNumber(parentGenome?.density ?? 0.45, 0.35 + lengthFactor * 0.5, 0.4).toFixed(3)),
        strokeWeight: Number(blendNumber(parentGenome?.strokeWeight ?? 2.2, Math.max(1.5, length / 10), 0.5).toFixed(3)),
        turbulence: Number(blendNumber(parentGenome?.turbulence ?? 0.16, 0.1 + timeFactor * 0.45, 0.35).toFixed(3)),
        glow: Number(blendNumber(parentGenome?.glow ?? 0.7, 0.45 + scoreFactor * 0.5, 0.5).toFixed(3)),
        motif: "sigil",
        ringCount: Math.max(3, Math.min(6, Math.round(blendNumber(parentGenome?.ringCount ?? 3, 3 + timeFactor * 3, 0.45))))
    };
}

export function createGenerativeArt({ startCol, endCol, length, score, time, genome, metrics = {}, relics = {} }) {
    const artCanvas = document.createElement("canvas");
    artCanvas.width = 768;
    artCanvas.height = 768;

    const ctx = artCanvas.getContext("2d");
    drawSigilBackground(ctx, genome.palette, genome.glow);
    drawArtifactTexture(ctx, genome.palette);
    drawOccultHalo(ctx, genome.palette, genome.glow);
    drawRoomConstellation(ctx, relics.rooms, genome.palette);
    drawGenerationRings(ctx, genome, relics.generation ?? 1);
    drawPathRelic(ctx, relics.path, genome);
    drawCoreSigil(ctx, genome, metrics);
    drawAppleMarks(ctx, relics.apples, genome.palette);
    drawDeathSeal(ctx, relics.deathPoint, genome.palette);
    drawFrame(ctx, genome.palette);

    return artCanvas.toDataURL("image/png");
}
