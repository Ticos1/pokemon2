# Pokémon: Jornada por Kanto

Jogo de navegador em pixel art no estilo GBA (FireRed/LeafGreen). O treinador anda sozinho pela rota e
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

## A jornada (15 paradas)

| Parada | O que é |
|---|---|
| 10 eventos | Eventos aleatórios + 4 cidades (Centro Pokémon e Loja) |
| 4 Líderes | Brock (Pedra), Misty (Água), Lt. Surge (Elétrico), Erika (Planta) |
| Campeão | Blue, com o inicial que tem vantagem sobre o seu |

Eventos aleatórios possíveis:

- **Grama alta**: Pokémon selvagem. Quando ele fica fraco, aparece a opção de jogar a Poké Bola, que balança até 3 vezes e pode escapar.
- **Treinador**: batalha que dá dinheiro.
- **Bifurcação**: escolha entre grama alta (chance de shiny x3), treinador (mais dinheiro) ou trilha escura (tesouro ou emboscada).
- **Lago**: pesque um Pokémon aquático (cuidado com o Magikarp...).
- **Equipe Rocket**: batalha mais difícil; pode deixar cair um Doce Raro.
- **Rival Blue**: aparece mais forte a cada encontro.
- **Presente**: um senhor oferece um de dois Pokémon raros.
- **Item no chão**: Poké Bolas, poções, Reviver, Doce Raro ou Pepita.

Outras regras:

- Começa com o inicial de Kanto, 5 Poké Bolas, 2 Poções e ₽1000.
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
tools/build_assets.py   gera os arquivos de assets/
tools/sim.js            simula partidas sem tela para balancear (node tools/sim.js 40 1)
```

Para ajustar a dificuldade, veja `SLOT_LEVEL`, `GYMS`, `PLAYER_POWER` e `SHINY_RATE` em `js/rules.js`.

Sprites e dados: [PokéAPI](https://pokeapi.co/). Pokémon é marca da Nintendo/Game Freak. Projeto de fã, sem fins comerciais.
