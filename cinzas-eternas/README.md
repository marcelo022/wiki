# Cinzas Eternas

Soulslike 2D (visão de cima) para Android, com **fases infinitas** e **chefes variados**.

**Baixar:** [`CinzasEternas.apk`](CinzasEternas.apk) — instale no Android 7.0+ (permita "fontes desconhecidas").

## O jogo
- **7 classes iniciais** (Guerreiro, Cavaleiro, Bárbaro, Ladino, Samurai, Caçador, Feiticeiro) e **5 atributos**: Vigor, Fôlego, Força, Destreza e Intelecto.
- **9 tipos de arma, cada um com golpes próprios**: espada, adaga (investida e ataque pelas costas), espadão, machado (giro 360°), lança (estocadas longas), maça (impacto em área), katana (corte iaijutsu), arco (3 flechas perfurantes) e cajado (flecha de alma teleguiada e orbe explosivo, gastando mana).
- **50+ armas**, com escala por atributo (S/A/B/C/D/E), requisitos e reforço até +10 no ferreiro com Titanita. Cada um dos 25 chefes deixa uma **arma lendária única** (Kusanagi, Espada de Surtr, Presa de Fenrir, Facão do Curupira…).
- **Elementos**: fogo (queimadura), gelo (congela), raio (choque e postura), veneno e sangue (hemorragia).
- **Escudos** (absorção, estabilidade, bônus de aparo), **armaduras** (defesa, postura, bônus) e **13 anéis**. A **carga de equipamento** muda o rolamento: leve, médio, pesado ou sobrecarregado.
- **Itens**: bombas, facas, resinas elementais, erva verde, cristal de mana, almas consumíveis e osso do retorno, usados por um atalho rápido.
- **Loot**: brilhos dourados nas fases e itens deixados pelos inimigos, com equipamento temático de cada mitologia.
- **Fogueira**: subir de nível, inventário completo, ferreiro e mercadora, cujo estoque cresce a cada chefe derrotado.
- **Aparar estilo Sekiro**: toque DEFESA no instante do golpe para aparar ou segure para bloquear. Telegrafias douradas podem ser aparadas; vermelhas com 危 não. Quebrar a postura abre o **golpe fatal**.
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

Controles no PC (testar no navegador abrindo `web/index.html`): WASD mover, J ataque, K forte, I defesa/aparar, R usar item, F trocar item, B inventário, Espaço rolar, E curar, Q mira, Esc pausa.

## Compilar
```
./build.sh
```
Requer JDK 17+, Android SDK (`platforms;android-34`, `build-tools;35.0.0`) e Python 3 com Pillow. Não usa Gradle.
