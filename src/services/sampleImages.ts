/**
 * Helper to generate a realistic sample road pavement image with a pothole
 * directly via canvas, so users can test the real Gradio API immediately without
 * needing to upload their own file.
 */
export async function createSamplePotholeImageFile(type: 'pothole' | 'cracked' = 'pothole'): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Draw asphalt background
  ctx.fillStyle = '#262930';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add asphalt grain texture
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 45;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Road markings (yellow center line or white lane line)
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.setLineDash([60, 45]);
  ctx.moveTo(360, 0);
  ctx.lineTo(360, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Road edge stripe
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(60, 0);
  ctx.lineTo(60, canvas.height);
  ctx.stroke();

  if (type === 'pothole') {
    // Draw an irregular realistic pothole cavity
    ctx.save();
    ctx.translate(340, 310);

    // Dark cavity interior
    ctx.beginPath();
    ctx.fillStyle = '#0f1013';
    ctx.moveTo(-110, -25);
    ctx.bezierCurveTo(-140, 50, -80, 110, 10, 95);
    ctx.bezierCurveTo(85, 80, 140, 30, 120, -35);
    ctx.bezierCurveTo(90, -90, -40, -85, -110, -25);
    ctx.fill();

    // Deep water/shadow bottom
    ctx.beginPath();
    ctx.fillStyle = '#07080a';
    ctx.ellipse(5, 20, 65, 38, Math.PI / 12, 0, Math.PI * 2);
    ctx.fill();

    // Jagged asphalt broken edges
    ctx.strokeStyle = '#474c58';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Radiating fatigue cracks
    ctx.strokeStyle = '#181a1f';
    ctx.lineWidth = 2.5;
    const cracks = [
      [[-110, -25], [-160, -45], [-190, -30]],
      [[10, 95], [25, 145], [40, 175]],
      [[120, -35], [165, -60], [210, -50]],
      [[-40, -85], [-65, -135]],
    ];
    cracks.forEach((pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
    });

    ctx.restore();
  } else {
    // Cracked road pattern
    ctx.save();
    ctx.translate(360, 270);
    ctx.strokeStyle = '#121418';
    ctx.lineWidth = 3;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      let r = 0;
      for (let step = 0; step < 5; step++) {
        r += 30 + Math.random() * 20;
        const curA = angle + (Math.random() - 0.5) * 0.5;
        ctx.lineTo(Math.cos(curA) * r, Math.sin(curA) * r);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Convert canvas to Blob then File
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate image from canvas'));
        return;
      }
      const filename =
        type === 'pothole'
          ? 'sample_road_pothole_inspection.jpg'
          : 'sample_road_fatigue_cracking.jpg';
      const file = new File([blob], filename, { type: 'image/jpeg' });
      resolve(file);
    }, 'image/jpeg', 0.92);
  });
}
