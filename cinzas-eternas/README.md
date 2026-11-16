# Cinzas Eternas

Soulslike 2D (visão de cima) para Android, com **fases infinitas** e **chefes variados**.

**Baixar:** [`CinzasEternas.apk`](CinzasEternas.apk) — instale no Android 7.0+ (permita "fontes desconhecidas").

## O jogo
- Combate soulslike: ataque leve (combo de 3), ataque forte, rolamento com invencibilidade, estamina, frascos de cura, trava de mira.
- **Aparar estilo Sekiro**: toque DEFESA no instante do golpe para aparar (sem dano, faísca dourada) ou segure para bloquear (dano mínimo, mas enche sua postura). Apertar sem parar encurta a janela de aparo.
- **Postura**: aparar e golpear enchem a postura do inimigo (barra amarela). Quando ela quebra, aparece um ponto vermelho: o próximo ataque é um **golpe fatal** (mata inimigos comuns; tira 30% da vida de chefes). Se a sua postura encher de tanto bloquear, você fica atordoado.
- Telegrafias **douradas** podem ser aparadas (golpes, investidas, projéteis); **vermelhas** com o símbolo 危 não (impactos no chão, varreduras, fogo, raios) — role para fora.
- Ataques inimigos são telegrafados por áreas vermelhas que se enchem — role através deles ou saia da área.
- **8 reinos mitológicos** em ciclo infinito, cada um com cenário, obstáculos, inimigos e chefes próprios:

| Reino | Inimigos | Chefes |
|---|---|---|
| Grego — Labirinto de Creta | Hoplita Esqueleto, Harpia, Sátiro, Guardião de Bronze, Lâmia, Ciclope | Minotauro, Medusa, Hidra de Lerna, Cérbero |
| Nórdico — Helheim | Draugr, Lobo Warg, Einherjar Caído, Völva, Jötunn de Gelo | Fenrir, Surtr, Jörmungandr |
| Egípcio — Duat | Múmia, Chacal, Guarda da Tumba, Sacerdote Amaldiçoado, Escorpião Gigante | Apep, Ammit, Esfinge |
| Japonês — Yomi | Gaki, Kitsune, Tengu, Samurai Amaldiçoado, Onmyōji, Oni | Yamata no Orochi, Gashadokuro, Kyūbi no Kitsune |
| Asteca — Mictlān | Guerreiro Jaguar, Ahuizotl, Guerreiro Águia, Tzitzimitl, Guardião de Obsidiana | Cipactli, Rainha Tzitzimitl, Guardião do Mictlān |
| Folclore Brasileiro — Mata Encantada | Corpo-Seco, Mula sem Cabeça, Saci, Capelobo, Lobisomem | Boitatá, Mapinguari, Cuca, Curupira |
| Inferno (demonologia) | Condenado, Diabrete, Cavaleiro Infernal, Demônio de Fogo | Anjo Caído, Leviatã, Beemote |
| Eslavo — Floresta de Nav | Upyr, Volkolak, Bogatyr Caído, Rusalka, Leshy | Koschei, Baba Yaga, Zmei Gorynych |

- Cada reino tem 3 fases; a terceira é o covil do chefe. A cada volta completa, o reino traz um chefe diferente, e depois que todos aparecem eles retornam com títulos (Ancestral, Renascido…), cores, ataques extras e modificadores (Colossal, Veloz, Ardente, Sombrio, Gêmeos).
- Chefes entram em fúria com 50% de vida.
- Almas: gaste na fogueira em Vigor, Fôlego e Força. Ao morrer, você as perde, mas pode recuperá-las no local da morte.
- O progresso é salvo automaticamente.

Controles no PC (testar no navegador abrindo `web/index.html`): WASD mover, J ataque, K forte, I ou C defesa/aparar, Espaço rolar, E curar, Q mira, Esc pausa.

## Compilar
```
./build.sh
```
Requer JDK 17+, Android SDK (`platforms;android-34`, `build-tools;35.0.0`) e Python 3 com Pillow. Não usa Gradle.
