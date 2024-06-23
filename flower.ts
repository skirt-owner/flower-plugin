import randomColor from 'randomcolor';
import seedrandom from 'seedrandom';
import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import { makeNoise3D, Noise3D } from 'open-simplex-noise/lib/3d';

interface Circle {
    x: number;
    y: number;
    radius: number;
}

interface Params {
    frequency: number;
    magnitude: number;
    independence: number;
    spacing: number;
    count: number;
    strokeColor: string;
    fillColor: string;
}

/**
 * Draws a deformed circle on the canvas context.
 * @param ctx - The canvas rendering context.
 * @param circle - The circle to draw.
 * @param noise - The noise function for deformation.
 * @param params - The drawing parameters.
 * @param seed - The seed for random generation.
 */
const drawCircle = (
    ctx: CanvasRenderingContext2D,
    circle: Circle,
    noise: Noise3D,
    params: Params,
    seed: number
) => {
    ctx.beginPath();

    ctx.strokeStyle = params.strokeColor;
    ctx.fillStyle = params.fillColor;

    const samples = Math.floor(4 * circle.radius + 10);
    for (let i = 0; i < samples; i++) {
        const angle = (2 * Math.PI * i) / samples;

        const x = Math.cos(angle);
        const y = Math.sin(angle);

        const deformation = noise(x * params.frequency, y * params.frequency, seed) + 1;
        const radius = circle.radius * (1 + params.magnitude * deformation);

        ctx.lineTo(circle.x + radius * x, circle.y + radius * y);
    }

    ctx.closePath();

    ctx.fill();
    ctx.stroke();
};

/**
 * Generates drawing parameters based on a seed.
 * @param seed - The seed for random generation.
 * @returns The generated parameters.
 */
const generateParams = (seed: number): Params => {
    seedrandom(seed, { global: true });

    const params: Params = {
        frequency: parseFloat((Math.random() * 10).toFixed(2)),
        magnitude: parseFloat(Math.random().toFixed(3)),
        independence: parseFloat(Math.random().toFixed(3)),
        spacing: parseFloat((Math.random() * 0.5).toFixed(4)),
        count: Math.floor(Math.random() * 200 + 1),
        strokeColor: randomColor({ format: 'rgb' }),
        fillColor: randomColor({
            format: 'rgba',
            alpha: parseFloat(Math.random().toFixed(2)),
        }),
    };

    return params;
};

/**
 * Generates a flower image as a data URL.
 * @param size - The size of the image.
 * @param seed - The seed for random generation.
 * @returns The flower image as a data URL.
 */
export const getFlower = (size: number, seed: number): string => {
    if (size <= 0) {
        throw new Error('Size must be greater than 0');
    }
    
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    const params = generateParams(seed);

    const circle: Circle = {
        x: size / 2,
        y: size / 2,
        radius: size / 3,
    };
    circle.radius /= params.magnitude + 1;

    const noise = makeNoise3D(seed);

    for (let i = 0; i < params.count; i++) {
        drawCircle(ctx, circle, noise, params, seedrandom(seed + i * params.independence)());
        circle.radius *= 1 - params.spacing;
    }

    console.info(`New flower was created with seed:${seed} and size:${size}`);

    return canvas.toDataURL();
};
