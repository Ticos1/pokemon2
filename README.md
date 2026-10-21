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

## A jornada: 37 paradas sorteadas por Kanto

Antes de cada cidade com ginásio o treinador passa por **3 áreas sorteadas** de Kanto inteiro (qualquer rota,
a Floresta de Viridian, cavernas, a Torre Pokémon, o S.S. Anne, a Silph Co., a Zona Safári, a Estrada Vitória...),
cada uma com um evento sorteado. Depois vem a cidade: Centro Pokémon, loja e o ginásio. No fim, a Liga:

8 ginásios × (3 áreas + a cidade) + Elite dos 4 + Campeão = **37 paradas**.

| Ginásio | Cidade | Nível no caminho |
|---|---|---|
| **Brock** | Pewter | 4 a 9 |
| **Misty** | Cerulean | 14 a 21 |
| **Lt. Surge** | Vermilion | 19 a 25 |
| **Erika** | Celadon | 25 a 32 |
| **Koga** | Fuchsia | 31 a 38 |
| **Sabrina** | Saffron | 37 a 43 |
| **Blaine** | Cinnabar | 41 a 47 |
| **Giovanni** | Viridian | 45 a 51 |

- As 3 áreas antes de um ginásio são sempre diferentes, e em cavernas e prédios o andar também é sorteado.
  Cavernas e prédios usam o mapa de verdade de cada andar (FireRed); o nome do lugar aparece numa placa ao chegar.
- Cada lugar tem os Pokémon selvagens e os treinadores dele no Red/Blue (Zubat no Mt. Moon, Gastly na Torre,
  Chansey e Tauros no Safári...), mas o nível segue o próximo ginásio, não a área. Os de água só aparecem na
  pesca, no mar e nas Ilhas Espuma.
- Como são poucas batalhas entre os ginásios, cada batalha do caminho dá 4× a experiência do Game Boy
  (ginásios, Elite dos 4 e Campeão dão a normal).
- Ginásios, Elite dos 4 e o Campeão têm os times e níveis do Red/Blue (o time do Campeão muda com o seu inicial).
- Perder qualquer batalha é fim de jogo.

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

Lugares especiais (o código continua no jogo, mas eles não entram no sorteio das paradas):
cassino de Celadon, Zona Safári com Bolas Safári, ovo da Creche, fósseis, lendários e os encontros com o Blue.

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
js/kanto.js             Kanto inteiro: áreas, andares, selvagens de cada lugar e o sorteio das paradas da jornada
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
tools/build_paths.py    gera assets/paths.js: por onde andar em cada mapa (colisão do FireRed) e onde há água
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
python3 tools/build_paths.py ../pokefirered
```

Para gerar de novo os sprites dos Pokémon andando de lado (os seguidores originais do HeartGold/SoulSilver):

```bash
git clone --depth 1 https://github.com/pret/pokeheartgold ../pokeheartgold
python3 tools/build_overworld.py ../pokeheartgold
```

Sprites e dados: [PokéAPI](https://pokeapi.co/), [pret/pokefirered](https://github.com/pret/pokefirered) e [pret/pokeheartgold](https://github.com/pret/pokeheartgold). Pokémon é marca da Nintendo/Game Freak. Projeto de fã, sem fins comerciais.
