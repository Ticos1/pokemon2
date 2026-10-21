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

## A jornada (30 paradas)

Dois eventos surpresa e um ginásio, dois eventos e um ginásio... até as 8 insígnias. Depois vem mais um evento,
a Elite dos 4 e o Campeão. Os eventos são sorteados; o jogador não escolhe. O mesmo evento não sai duas vezes
seguidas (menos grama alta e treinador).

| Parada | O que é |
|---|---|
| 17 eventos | Sorteados entre os tipos abaixo |
| 8 ginásios | Brock, Misty, Lt. Surge, Erika, Koga, Sabrina, Blaine e Giovanni. Antes de cada um, a cidade tem Centro Pokémon (cura) e Loja |
| Elite dos 4 | Lorelei, Bruno, Agatha e Lance, em sequência, sem Centro Pokémon entre as salas |
| Campeão | Blue, com o inicial que tem vantagem sobre o seu |

Eventos possíveis:

- **Grama alta**: Pokémon selvagem (os de água só aparecem na pesca). Quando ele fica fraco, aparece a opção de jogar a Poké Bola, que balança até 3 vezes e pode escapar.
- **Treinador**: batalha que dá dinheiro (16 classes de treinador do FireRed).
- **Lago**: um pescador empresta a vara (Magikarp, Krabby, Tentacool, Goldeen, Staryu, Slowpoke...) e começa o minijogo de pesca (estilo Stardew Valley). Segure o clique
  ou ESPAÇO para a barra verde subir e mantenha o peixe dentro dela até encher o medidor. Pescaria perfeita
  deixa o Pokémon cansado (mais fácil de capturar), e às vezes vem um baú com item. No AUTO, o pescador
  automático erra de vez em quando nos peixes difíceis (Gyarados, Dratini, Lapras).
- **Equipe Rocket**: batalha mais difícil; pode deixar cair um Doce Raro.
- **Rival Blue**: aparece mais forte a cada encontro.
- **Presente**: um senhor te dá um Pokémon raro.
- **Item no chão**: Poké Bolas, poções, Reviver, Doce Raro ou Pepita.

Outras regras:

- Começa com o inicial de Kanto, 5 Poké Bolas, 2 Poções e ₽1000.
- Todo o time ganha experiência (quem fica no banco ganha 85%).
- Shiny: 1 em 80 nos selvagens. Lendários (aves e Mewtwo/Mew) podem aparecer na reta final.
- Evolução por nível com animação. Evoluções por pedra ou troca viram nível fixo.
- Golpes de verdade: cada Pokémon aprende os golpes de dano que aprende subindo de nível no FireRed/LeafGreen
  (com a força daquela geração) e guarda os da pré-evolução. Com 4 golpes, esquece o mais fraco para aprender
  o novo. Cada golpe tem um jeito na arena: investida, projétil, raio, impacto na área do alvo ou onda ao redor.
  Golpes de status (Rosnado, Pó do Sono...) ficam de fora da batalha em tempo real.
- Cada inicial tem resposta para os ginásios que levam vantagem sobre ele (MT/tutor do FireRed): Charmander
  aprende Garra de Metal (Nv 6, contra o Brock) e Soco Trovão (Nv 9, contra a Misty), a linha do Squirtle
  aprende Vento Gelado (Nv 18, contra a Erika) e a do Bulbasaur, Bomba de Lodo (Nv 28).
- Vantagem de tipo, golpe do mesmo tipo do Pokémon (STAB), críticos, queimadura, veneno, paralisia e lentidão.
- Modos **1x1** e **2x2**.
- Se o time todo desmaiar, é fim de jogo. A tela mostra até onde você chegou.

## Estrutura

```
index.html, style.css   página e estilo
manifest.webmanifest    app instalável; sw.js guarda os arquivos para jogar offline
js/rules.js             tipos, golpes de cada Pokémon, ginásios, treinadores, loja
js/moves.js             golpes do FireRed na arena: nome em português e jeito de cada golpe
js/mon.js               status, experiência e evolução dos Pokémon
js/progress.js          XP, times inimigos e sorteio da rota
js/journey.js           regras da jornada (inimigos de cada parada, prêmios, cura, itens, pesca), usadas pelo jogo e pelo simulador
js/battle.js            batalha em tempo real (lógica + desenho)
js/fishing.js           minijogo de pesca
js/world.js             caminhada para a direita: mapa, cidades, grama alta, lagos e personagens
js/events.js            o que acontece em cada parada da rota
js/game.js              estado, HUD, menus, batalhas, telas de início e fim, loop
js/save.js              jogo salvo e preferências (localStorage)
js/art.js, js/ui.js     desenho dos sprites e interface
js/audio.js             efeitos sonoros sintetizados
assets/                 sprites e dados gerados da PokéAPI (moves.js: golpes por nível do FireRed)
assets/gba/             gráficos do FireRed: personagens, retratos, tiles, prédios, arenas
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
