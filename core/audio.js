export const AudioSys = {
  sfx: {},
  music: {},
  playSfx(name) {
    if(this.sfx[name]) this.sfx[name].play();
  },
  playMusic(name, loop=true) {
    if(this.music.current) this.music.current.pause();
    this.music.current = this.music[name];
    if(this.music.current) {
      this.music.current.loop = loop;
      this.music.current.play();
    }
  },
  load() {
    this.sfx['door'] = new Audio('assets/audio/sfx/door.wav');
    this.sfx['attack'] = new Audio('assets\audio\sfx\slash.mp3');
    this.music['dungeon'] = new Audio('assets/audio/music/dungeon.ogg');
  }
};
