const Haxball = require("haxball.js");

// Token Railway Environment Variable'dan çekilecek
const TOKEN = process.env.HAXBALL_TOKEN; 
const ADMIN_SIFRESI = "123456";
const TAKIM_KAPASITESI = 3; // 3v3

const banliIPler = new Set();
const banliPublicKeys = new Set();
const susturulanlar = new Map();

Haxball().then((HBInit) => {
  const room = HBInit({
    roomName: "⚽ 3v3 Auto-Match | Ofsayt + Ban/Mute",
    maxPlayers: 16,
    public: true,
    noPlayer: true,
    token: TOKEN
  });

  room.setDefaultStadium("Classic");
  room.setScoreLimit(3);
  room.setTimeLimit(3);

  let topSonDokunan = null;

  room.onRoomLink = (link) => {
    console.log("========================================");
    console.log("ODA LİNKİ: " + link);
    console.log("========================================");
  };

  room.onPlayerJoin = (player) => {
    if (banliIPler.has(player.conn) || banliPublicKeys.has(player.auth)) {
      room.kickPlayer(player.id, "🚫 Bu odadan yasaklandınız!", true);
      return;
    }

    room.sendAnnouncement("👋 Hoş geldin " + player.name + "! Komutlar için !yardim yazabilirsin.", player.id, 0x00FF00, "bold");

    if (room.getPlayerList().length === 1) {
      room.setPlayerAdmin(player.id, true);
    }

    dengkeleVeBaslat();
  };

  room.onPlayerLeave = () => {
    dengkeleVeBaslat();
  };

  // Ofsayt Kontrolü
  room.onPlayerBallKick = (player) => {
    topSonDokunan = player;
    const ball = room.getBallPosition();
    if (!ball) return;

    const rakipTakim = player.team === 1 ? 2 : 1;
    const hucumYonu = player.team === 1 ? 1 : -1;

    const takimArkadaslari = room.getPlayerList().filter(p => p.team === player.team && p.id !== player.id);
    
    takimArkadaslari.forEach(tas => {
      const topaGoreOnde = hucumYonu === 1 ? tas.position.x > ball.x : tas.position.x < ball.x;
      if (!topaGoreOnde) return;

      const rakipler = room.getPlayerList().filter(p => p.team === rakipTakim);
      if (rakipler.length < 2) return;

      rakipler.sort((a, b) => hucumYonu === 1 ? b.position.x - a.position.x : a.position.x - b.position.x);
      const sonSavunmaci = rakipler[1];

      const ofsayttaMi = hucumYonu === 1 ? tas.position.x > sonSavunmaci.position.x : tas.position.x < sonSavunmaci.position.x;

      if (ofsayttaMi && (hucumYonu === 1 ? ball.x > 0 : ball.x < 0)) {
        room.sendAnnouncement("🚩 OFSAYT! " + tas.name + " ofsayt pozisyonunda!", null, 0xFF0000, "bold");
        room.stopGame();
        setTimeout(() => room.startGame(), 2000);
      }
    });
  };

  // Maç Bitişi
  room.onTeamVictory = (scores) => {
    const kazanan = scores.red > scores.blue ? 1 : 2;
    const kaybeden = kazanan === 1 ? 2 : 1;

    room.sendAnnouncement("🏆 Maç Bitti! Kazanan Takım Sahada Kalıyor.", null, 0xFFFF00, "bold");

    room.getPlayerList().forEach(p => {
      if (p.team === kaybeden) room.setPlayerTeam(p.id, 0);
    });

    setTimeout(() => dengkeleVeBaslat(), 2000);
  };

  function dengkeleVeBaslat() {
    const players = room.getPlayerList();
    const izleyiciler = players.filter(p => p.team === 0);
    const kirmizi = players.filter(p => p.team === 1);
    const mavi = players.filter(p => p.team === 2);

    while (kirmizi.length < TAKIM_KAPASITESI && izleyiciler.length > 0) {
      const p = izleyiciler.shift();
      room.setPlayerTeam(p.id, 1);
      kirmizi.push(p);
    }

    while (mavi.length < TAKIM_KAPASITESI && izleyiciler.length > 0) {
      const p = izleyiciler.shift();
      room.setPlayerTeam(p.id, 2);
      mavi.push(p);
    }

    if (kirmizi.length === TAKIM_KAPASITESI && mavi.length === TAKIM_KAPASITESI && room.getScores() === null) {
      room.startGame();
      room.sendAnnouncement("🚀 Maç Başladı!", null, 0x00FF00, "bold");
    }
  }

  // Komutlar ve Moderasyon
  room.onPlayerChat = (player, message) => {
    if (susturulanlar.has(player.id)) {
      if (Date.now() < susturulanlar.get(player.id)) {
        room.sendAnnouncement("🔇 Susturuldunuz!", player.id, 0xFF0000);
        return false;
      } else {
        susturulanlar.delete(player.id);
      }
    }

    const args = message.split(" ");
    const cmd = args[0].toLowerCase();

    if (cmd === "!admin") {
      if (args[1] === ADMIN_SIFRESI) {
        room.setPlayerAdmin(player.id, true);
        room.sendAnnouncement("✅ Admin yetkisi verildi.", player.id, 0x00FF00);
      } else {
        room.sendAnnouncement("❌ Yanlış şifre!", player.id, 0xFF0000);
      }
      return false;
    }

    if (cmd === "!mute" && player.admin) {
      const targetId = parseInt(args[1]);
      const dakika = parseInt(args[2]) || 3;
      const target = room.getPlayer(targetId);
      if (target) {
        susturulanlar.set(targetId, Date.now() + dakika * 60000);
        room.sendAnnouncement("🔇 " + target.name + " " + dakika + " dakika susturuldu!", null, 0xFF0000, "bold");
      }
      return false;
    }

    if (cmd === "!ban" && player.admin) {
      const targetId = parseInt(args[1]);
      const target = room.getPlayer(targetId);
      if (target) {
        banliIPler.add(target.conn);
        banliPublicKeys.add(target.auth);
        room.kickPlayer(targetId, "Yasaklandınız!", true);
        room.sendAnnouncement("🔨 " + target.name + " odadan yasaklandı!", null, 0xFF0000, "bold");
      }
      return false;
    }

    if (cmd === "!bb") {
      room.kickPlayer(player.id, "Görüşmek üzere!", false);
      return false;
    }
  };
});
