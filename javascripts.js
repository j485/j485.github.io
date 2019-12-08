function PlaySound(soundobj) {
    var thissound=document.getElementById(soundobj);
    thissound.play();
}

function StopSound(soundobj) {
    var thissound=document.getElementById(soundobj);
    thissound.pause();
    thissound.currentTime = 0;
}

function share(){
    var str1 = "http://open.spotify.com/track/";
    var str2 = data.tracks.items[i].track.uri;
    var url = str1.concat(str2);
    url.execCommand("copy");
}