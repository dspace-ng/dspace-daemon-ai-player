var Faye = require('faye');
var GameLoopDispatch = require('game-loop-dispatch');
var uuid = require('node-uuid');

var avatars = [
  'elvis',
  'emo',
  'escafandra',
  'estilista',
  'extraterrestre',
  'fisicoculturista',
  'funky',
  'futbolista_brasilero',
  'gay',
  'geisha',
  'ghostbuster',
  'glamrock_singer',
  'guerrero_chino',
  'hiphopper',
  'hombre_hippie'
];

var ghost = {
  uuid: uuid(),
  avatar: 'hiphopper',
  nickname: 'ghost',
  color: '#' + Math.floor(Math.random()*16777215).toString(16),
  channels: {
    profile: '/278d8967-f242-46fc-97bc-e0a36f71871e/profile',
    track: '/278d8967-f242-46fc-97bc-e0a36f71871e/track'
  }
};

var lat = 47.07;
var lng = 15.42;

var wind = {
  lat: 0.001,
  lng: 0.001
};

var pubsub = new Faye.Client('http://localhost:5000/faye');

var loop = new GameLoopDispatch({ interval: 2000 });

var counter = 0;

loop.tick = function(){
  pubsub.publish('/positions',
                 { coords:
                   { latitude: lat,
                     longitude: lng,
                     accuracy: 20 },
                     timestamp: new Date().getTime(),
                     player: { uuid: ghost.uuid } }
                );

  ghost.avatar = avatars[counter % 15 ];
  pubsub.publish('/players', ghost);

  if(counter % 20 === 0){
    wind.lat *= -1;
  }
  if(counter % 20 === 10){
    wind.lng *= -1;
  }
  lat += wind.lat;
  lng += wind.lng;

  counter++;
};

loop.start();
