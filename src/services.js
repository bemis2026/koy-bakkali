// Hizmetlerin kare güncellemesi tek yerden (world.js updateWorld): avatar işareti,
// uzak istek müşterileri, banka, kasa hesapları, taşınan ürünlerin gideceği yerler, hazır ürün rozetleri, genişleme arsaları, deniz dalgaları.
import { G } from './game.js';
import { updateAvatarMark } from './avatar.js';
import { updateRequests } from './requests.js';
import { updateBank } from './bank.js';
import { updateSea } from './sea.js';
import { updateKasa } from './account.js';
import { updateDest } from './dest.js';
import { updateRipe } from './ripe.js';
import { updateExpansions } from './expand.js';
import { updateExpandWest } from './expand-west.js';
import { updateExpandEast } from './expand-east.js';
import { updateCop } from './cop.js';
import { updateTatil } from './tatil.js';

export function updateServices(dt) {
  updateAvatarMark(dt);
  updateRequests(dt);
  updateBank(dt);
  updateKasa(dt);
  updateDest(dt);
  updateRipe(dt);
  updateExpansions(dt);
  updateExpandWest(dt);
  updateExpandEast(dt); // doğu bölgelerinin genişletmeleri: arılar, kahvehane, konser, konuk geliri
  updateSea(dt);
  updateCop(dt); // sokak çöpü, sokak hayvanları, çöpçüler (cop.js)
  updateTatil(dt); // keyif, elmas, tatil acentesi ve Martı Adası (tatil.js)
}
