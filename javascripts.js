var x = document.getElementById("myAudio");

function playAudio() {
  x.play();
  console.log("musicplay");
}

function pauseAudio() {
  x.pause();
  console.log("musicpause");
}