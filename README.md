# Pokémon: Jornada por Kanto

Jogo de navegador com os gráficos do GBA (FireRed/LeafGreen). O treinador anda sozinho pela rota e
vão aparecendo eventos no caminho. As batalhas acontecem **sozinhas, em tempo real**, numa arena vista
de cima, com os Pokémon soltando os golpes.

Feito para gravar a tela e postar (formato vertical 9:16).

## Como jogar

Abra o `index.html` no navegador (Chrome, Edge ou Firefox), com dois cliques no arquivo.

Se algo não carregar, rode um servidor local na pasta do projeto e acesse http://localhost:8000:

```bash
python3 -m http.server 8000
```

- **Clique** ou **ESPAÇO** avança os textos.
- **1x / 2x / 4x** muda a velocidade do jogo.
- **AUTO** faz os textos avançarem sozinhos (bom para gravar).
- Clique num Pokémon da barra de baixo para ver os status, usar itens, colocar na frente ou trocar com o PC.
- Na batalha: **MOCHILA** pausa e deixa usar poções; **FUGIR** só funciona contra selvagens.

## A jornada (22 paradas)

Um evento surpresa, um ginásio, um evento, um ginásio... até as 8 insígnias. Depois vem mais um evento,
a Elite dos 4 e o Campeão. Os eventos são sorteados; o jogador não escolhe.

| Parada | O que é |
|---|---|
| 9 eventos | Sorteados entre os tipos abaixo |
| 8 ginásios | Brock, Misty, Lt. Surge, Erika, Koga, Sabrina, Blaine e Giovanni. Antes de cada um, a cidade tem Centro Pokémon (cura) e Loja |
| Elite dos 4 | Lorelei, Bruno, Agatha e Lance, em sequência, sem Centro Pokémon entre as salas |
| Campeão | Blue, com o inicial que tem vantagem sobre o seu |

Eventos possíveis:

- **Grama alta**: Pokémon selvagem. Quando ele fica fraco, aparece a opção de jogar a Poké Bola, que balança até 3 vezes e pode escapar.
- **Treinador**: batalha que dá dinheiro (16 classes de treinador do FireRed).
- **Lago**: um pescador empresta a vara e você pesca um Pokémon aquático (cuidado com o Magikarp...).
- **Equipe Rocket**: batalha mais difícil; pode deixar cair um Doce Raro.
- **Rival Blue**: aparece mais forte a cada encontro.
- **Presente**: um senhor te dá um Pokémon raro.
- **Item no chão**: Poké Bolas, poções, Reviver, Doce Raro ou Pepita.

Outras regras:

- Começa com o inicial de Kanto, 5 Poké Bolas, 2 Poções e ₽1000.
- Todo o time ganha experiência (quem fica no banco ganha 85%).
- Shiny: 1 em 80 nos selvagens. Lendários (aves e Mewtwo/Mew) podem aparecer na reta final.
- Evolução por nível com animação. Evoluções por pedra ou troca viram nível fixo.
- Vantagem de tipo, golpe do mesmo tipo do Pokémon (STAB), críticos, queimadura, veneno, paralisia e lentidão.
- Modos **1x1** e **2x2**.
- Se o time todo desmaiar, é fim de jogo. A tela mostra até onde você chegou.

## Estrutura

```
index.html, style.css   página e estilo
js/rules.js             tipos, golpes, ginásios, treinadores, loja
js/mon.js               status, experiência e evolução dos Pokémon
js/progress.js          XP, times inimigos e sorteio da rota
js/battle.js            batalha em tempo real (lógica + desenho)
js/game.js              caminhada, eventos, menus e telas
js/art.js, js/ui.js     pixel art e interface
js/audio.js             efeitos sonoros sintetizados
assets/                 sprites e dados gerados da PokéAPI
assets/gba/             gráficos do FireRed: personagens, retratos, tiles, prédios, arenas
tools/build_assets.py   gera os Pokémon e itens de assets/ (PokéAPI)
tools/build_gba.py      gera assets/gba/ a partir do projeto pret/pokefirered
tools/gba_maps.py       renderiza mapas e metatiles do FireRed
tools/sim.js            simula partidas sem tela para balancear (node tools/sim.js 40 1)
```

Para ajustar a dificuldade, veja `SLOT_LEVEL`, `GYMS`, `PLAYER_POWER` e `SHINY_RATE` em `js/rules.js`.

Para gerar de novo os gráficos do GBA:

```bash
git clone --depth 1 https://github.com/pret/pokefirered ../pokefirered
python3 tools/build_gba.py ../pokefirered
```

Sprites e dados: [PokéAPI](https://pokeapi.co/) e [pret/pokefirered](https://github.com/pret/pokefirered). Pokémon é marca da Nintendo/Game Freak. Projeto de fã, sem fins comerciais.
