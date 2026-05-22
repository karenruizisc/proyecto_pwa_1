document.addEventListener('DOMContentLoaded', () => {
  const btnCamara = document.getElementById('btnCamara');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const foto = document.getElementById('foto');
  const btnFoto = document.getElementById('btnFoto');
  const cameraSelect = document.getElementById('cameraSelect');
  let stream;

  btnCamara.onclick = async () => {
    try {
      if (stream) stream.getTracks().forEach(track => track.stop());
      const facingMode = cameraSelect.value;
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      video.srcObject = stream;
      video.style.display = 'block';
      btnFoto.style.display = 'inline-block';
      foto.style.display = 'none';
      canvas.style.display = 'none';
    } catch (err) {
      alert('No se pudo acceder a la cámara: ' + err.message);
    }
  };

  btnFoto.onclick = () => {
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    foto.src = canvas.toDataURL('image/png');
    foto.style.display = 'block';
    canvas.style.display = 'none';
    video.style.display = 'none';
    btnFoto.style.display = 'none';
    if (stream) stream.getTracks().forEach(track => track.stop());
  };
});