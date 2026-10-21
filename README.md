# Pokémon: Jornada por Kanto

Jogo de navegador com os gráficos do GBA (FireRed/LeafGreen). O treinador anda sozinho pela rota e
vão aparecendo eventos no caminho. As batalhas acontecem **sozinhas, em tempo real**, numa arena vista
de cima, com os Pokémon soltando os golpes.

Feito para gravar a tela e postar (formato vertical 9:16).

## Como jogar

Jogue direto no navegador: **https://ticos1.github.io/pokemon2/**

No celular dá para instalar (menu do navegador → "Adicionar à tela inicial"): abre em tela cheia e funciona sem internet.

Para rodar no computador, abra o `index.html` com dois cliques. Se algo não carregar, rode um servidor local
na pasta do projeto e acesse http://localhost:8000:

```bash
python3 -m http.server 8000
```

- **Clique** ou **ESPAÇO** avança os textos.
- **1x / 2x / 4x** muda a velocidade do jogo.
- **AUTO** faz os textos avançarem sozinhos.
- **MODO GRAVAÇÃO** (na tela inicial): textos, escolhas, captura e loja no automático, sem botões nem cursor
  na tela. Depois de apertar COMEÇAR, a partida vai sozinha até o fim. As teclas **1**, **2** e **4** mudam a
  velocidade e **ESC** desliga o modo.
- Clique num Pokémon da barra de baixo para ver a vida, os status, os golpes (e o próximo que ele vai aprender),
  usar itens, colocar na frente ou trocar com o PC.
- Na batalha: **MOCHILA** pausa e deixa usar poções; **TIME** pausa e mostra a vida e os golpes de cada Pokémon;
  **FUGIR** só funciona contra selvagens. O nome de cada golpe aparece em cima de quem usou.
- O jogo salva sozinho antes de cada parada. Na tela inicial aparece **CONTINUAR**.

## A jornada: Kanto inteiro, como no Red/Blue

O treinador atravessa Kanto na ordem do jogo de Game Boy, com cerca de 100 paradas. Cavernas e prédios usam o
mapa de verdade de cada andar (FireRed); o nome do lugar aparece numa placa ao chegar.

| Trecho | Lugares |
|---|---|
| Começo | Rota 1, Viridian, Rota 22 (Blue), Rota 2, Floresta de Viridian, Pewter (Museu, **Brock**) |
| Mt. Moon | Rota 3 (vendedor de Magikarp por ₽500), Mt. Moon 1F, B1F e B2F (Equipe Rocket e a escolha do fóssil) |
| Cerulean | Blue, Ponte Pepita (Rota 24), casa do Bill (Rota 25), **Misty** |
| Vermilion | Creche da Rota 5 (ovo), Rota 6, Fã-Clube, S.S. Anne (convés, 1F, 2F com o Blue, cabine do capitão), **Lt. Surge** |
| Lavender e Celadon | Rotas 9 e 10, Túnel de Pedra 1F e B1F (escuro: Flash), Torre Pokémon 1F a 3F (Blue e o fantasma), Rota 8, Celadon (Loja de Departamentos com pedras, Eevee na Mansão, **Cassino**, Esconderijo Rocket B1F a B4F com Giovanni), **Erika** |
| Torre Pokémon | 3F a 7F com o Scope Silph: zona purificada (cura), fantasma do Marowak, Equipe Rocket e o Sr. Fuji (Poké Flauta) |
| Fuchsia e Saffron | Rotas 12–15 ou Ciclovia (os dois com **Snorlax**), **Zona Safári**, Casa do Guarda (Surfe), **Koga**, Silph Co. 2F a 11F (Blue, Lapras, Giovanni e a Bola Mestra), Dojo de Luta (Hitmonlee ou Hitmonchan), **Sabrina** |
| Cinnabar | Ilhas Espuma 1F a B4F (**Articuno**) ou Rota 21 passando por Pallet, Mansão Pokémon 1F, 2F, 3F e B1F (o diário do Mew), Laboratório (revive os fósseis), quiz das portas, **Blaine** |
| Reta final | Usina Elétrica (**Zapdos**), **Giovanni** em Viridian, Blue na Rota 22, Rota 23, Estrada Vitória 1F a 3F (**Moltres**), Elite dos 4 e o Campeão |
| Depois da Liga | Caverna Desconhecida 1F, 2F e B1F, com o **Mewtwo** |

- Cada lugar tem os Pokémon selvagens e os treinadores dele no Red/Blue (Zubat no Mt. Moon, Gastly na Torre,
  Chansey e Tauros no Safári...). Os de água só aparecem na pesca, no mar e nas Ilhas Espuma.
- Ginásios, Elite dos 4, Giovanni e os 6 encontros com o Blue têm os times e níveis do Red/Blue (o time do Blue
  muda com o seu inicial). Antes de cada ginásio tem Centro Pokémon.
- **Bifurcações**: em três lugares o jogador escolhe o caminho: Caverna do Diglett ou Rota 11; Rotas 12–15 ou
  Ciclovia; Ilhas Espuma (com Articuno) ou Rota 21.
- **Lendários** (Articuno, Zapdos, Moltres, Mewtwo) e **Snorlax**: dá para capturar. Se o time perder, o jogo
  continua e a próxima parada é um Centro Pokémon.
- Perder em qualquer outra batalha é fim de jogo. Depois de virar Campeão, perder na Caverna Desconhecida não
  tira o título.

Eventos sorteados no caminho (o mesmo não sai duas vezes seguidas, menos grama e treinador):

- **Grama alta** / Pokémon selvagem. Quando ele fica fraco, aparece a opção de jogar a Poké Bola, que balança até
  3 vezes e pode escapar.
- **Treinador** e **dupla de treinadores** (batalha 2x2 mesmo no modo 1x1).
- **Lago**: um pescador empresta a vara e começa o minijogo de pesca (estilo Stardew Valley). Segure o clique
  ou ESPAÇO para a barra verde subir e mantenha o peixe dentro dela até encher o medidor. Pescaria perfeita
  deixa o Pokémon cansado (mais fácil de capturar), e às vezes vem um baú com item. A pesca roda sempre em 1x
  (depois volta para a velocidade escolhida) e quem segura a barra é sempre o jogador, mesmo com AUTO ligado.
  Só o modo gravação pesca sozinho.
- **Equipe Rocket**: batalha mais difícil; pode deixar cair um Doce Raro.
- **Mercador**: vende Doce Raro, pedras de evolução e outros itens raros, caro.
- **Mudança de tempo** (só ao ar livre, por 4 paradas): chuva (água mais forte, fogo mais fraco), sol forte (o
  contrário), tempestade de areia e granizo (machucam aos poucos quem não é do tipo que aguenta).
- **Presente** e **item no chão** (Poké Bolas, poções, Reviver, Doce Raro, pedras ou Pepita).

Lugares especiais:

- **Cassino de Celadon**: 50 fichas por ₽1000; o caça-níquel gira e cada toque para um rolo (paga na linha do
  meio). Na sala de prêmios as fichas viram Abra, Clefairy, Nidorina, Dratini, Scyther ou Porygon.
- **Zona Safári**: ₽500 e 30 Bolas Safári por 4 áreas. Sem batalha: bola, isca (fica calmo, mais difícil de
  pegar), pedra (fica bravo, mais fácil de pegar, mas foge mais) ou fugir.
- **Ovo da Creche** (Rota 5): choca depois de 4 paradas, com um Pokémon raro (Dratini, Eevee, Lapras, Chansey...).
- **Fósseis**: no Mt. Moon você escolhe o Domo ou o Hélix, e o Museu de Pewter dá o Âmbar Antigo. O laboratório
  de Cinnabar revive todos (Kabuto, Omanyte, Aerodactyl).
- **Pedras de evolução**: na mochila, use no Pokémon para evoluir na hora.

Outras regras:

- Começa com o inicial de Kanto, 5 Poké Bolas, 2 Poções e ₽3000.
- Todo o time ganha experiência (quem fica no banco ganha 85%). A experiência segue a fórmula do Game Boy
  (base da espécie × nível ÷ 7), ajustada pela diferença de nível: quem está abaixo do inimigo ganha mais.
- Shiny: 1 em 80 nos selvagens.
- Evolução por nível com animação. Evoluções por pedra ou troca viram nível fixo.
- Golpes de verdade: cada Pokémon aprende os golpes de dano que aprende subindo de nível no FireRed/LeafGreen
  (com a força daquela geração) e guarda os da pré-evolução. Com 4 golpes, esquece o mais fraco para aprender
  o novo. Cada golpe tem um jeito na arena: investida, projétil, raio, impacto na área do alvo ou onda ao redor.
  Golpes de status (Rosnado, Pó do Sono...) ficam de fora da batalha em tempo real.
- Cada inicial tem resposta para os ginásios que levam vantagem sobre ele (MT/tutor do FireRed): Charmander
  aprende Garra de Metal (Nv 6, contra o Brock) e Soco Trovão (Nv 9, contra a Misty), a linha do Squirtle
  aprende Vento Gelado (Nv 18, contra a Erika) e a do Bulbasaur, Folha Navalha (Nv 13), Bomba de Lodo (Nv 28) e
  Raio Solar (Nv 40).
- Vantagem de tipo, golpe do mesmo tipo do Pokémon (STAB), críticos, queimadura, veneno, paralisia e lentidão.
- Modos **1x1** e **2x2**.
- Se o time todo desmaiar, é fim de jogo. A tela mostra até onde você chegou.

## Estrutura

```
index.html, style.css   página e estilo
manifest.webmanifest    app instalável; sw.js guarda os arquivos para jogar offline
js/rules.js             tipos, golpes de cada Pokémon, ginásios, Blue, treinadores, itens e pedras
js/kanto.js             Kanto inteiro: áreas, andares, selvagens de cada lugar, a ordem da jornada e as bifurcações
js/moves.js             golpes do FireRed na arena: nome em português e jeito de cada golpe
js/mon.js               status, experiência e evolução dos Pokémon
js/progress.js          XP, times inimigos e sorteio da rota
js/journey.js           regras da jornada (inimigos de cada parada, prêmios, ovo, mercador, clima, Safári, cassino,
                        quiz, fósseis, pesca), usadas pelo jogo e pelo simulador
js/scenes.js            telas do caça-níquel e da Zona Safári
js/battle.js            batalha em tempo real (lógica + desenho)
js/fishing.js           minijogo de pesca
js/world.js             caminhada para a direita: rota, cidades, grama alta, lagos, personagens e os mapas dos andares
js/events.js            o que acontece em cada parada da rota
js/game.js              estado, HUD, menus, batalhas, telas de início e fim, loop
js/save.js              jogo salvo e preferências (localStorage)
js/art.js, js/ui.js     desenho dos sprites e interface
js/audio.js             efeitos sonoros sintetizados
assets/                 sprites e dados gerados da PokéAPI (moves.js: golpes por nível do FireRed)
assets/gba/             gráficos do FireRed: personagens, retratos, tiles, prédios, arenas e mapas dos andares (maps/)
assets/fonts/           fonte Press Start 2P (licença OFL)
tools/build_assets.py   gera os Pokémon e itens de assets/ (PokéAPI)
tools/build_moves.py    gera assets/moves.js (golpes que cada Pokémon aprende por nível, PokéAPI)
tools/build_gba.py      gera assets/gba/ a partir do projeto pret/pokefirered
tools/build_overworld.py gera assets/overworld.png (Pokémon andando de lado) do pret/pokeheartgold
tools/gba_maps.py       renderiza mapas e metatiles do FireRed
tools/sim.js            simula partidas sem tela para balancear (node tools/sim.js 40 1)
tools/test.js           testes rápidos (node tools/test.js), rodam no GitHub Actions a cada push
```

Para ajustar a dificuldade, veja `SLOT_LEVEL`, `GYMS` (nível e `iv` dos líderes), `PLAYER_POWER` e `SHINY_RATE`
em `js/rules.js`, e confira com o simulador. Com 100 partidas por inicial no 1x1, cada um chega ao título de
Campeão em cerca de 20% a 50% das vezes (Bulbasaur é o mais difícil), e nenhum ginásio derruba mais de ~15% das partidas.

Para gerar de novo os gráficos do GBA:

```bash
git clone --depth 1 https://github.com/pret/pokefirered ../pokefirered
python3 tools/build_gba.py ../pokefirered
```

Para gerar de novo os sprites dos Pokémon andando de lado (os seguidores originais do HeartGold/SoulSilver):

```bash
git clone --depth 1 https://github.com/pret/pokeheartgold ../pokeheartgold
python3 tools/build_overworld.py ../pokeheartgold
```

Sprites e dados: [PokéAPI](https://pokeapi.co/), [pret/pokefirered](https://github.com/pret/pokefirered) e [pret/pokeheartgold](https://github.com/pret/pokeheartgold). Pokémon é marca da Nintendo/Game Freak. Projeto de fã, sem fins comerciais.
