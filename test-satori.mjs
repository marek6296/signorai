import { satori } from '@satori/core';
import { html } from 'satori-html';

const markup = html`
  <div style="display: flex; width: 100px; height: 100px; background-image: radial-gradient(circle at top right, rgba(255,255,255,0.15) 0%, transparent 60%);">
  </div>
`;

try {
  const result = await satori(markup, { width: 100, height: 100, fonts: [{ name: 'sans', data: Buffer.alloc(1), weight: 400, style: 'normal' }] });
  console.log("Success radial gradient");
} catch (e) {
  console.log("Error:", e.message);
}
