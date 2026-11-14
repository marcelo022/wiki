# Cinzas Eternas

Soulslike 2D (visão de cima) para Android, com **fases infinitas** e **chefes variados**.

**Baixar:** [`CinzasEternas.apk`](CinzasEternas.apk) — instale no Android 7.0+ (permita "fontes desconhecidas").

## O jogo
- Combate soulslike: ataque leve (combo de 3), ataque forte, rolamento com invencibilidade, estamina, frascos de cura, trava de mira.
- Ataques inimigos são telegrafados por áreas vermelhas que se enchem — role através deles ou saia da área.
- Fases geradas proceduralmente e infinitas, com 8 biomas que se alternam. A dificuldade escala a cada fase.
- Um chefe a cada 3 fases. 9 arquétipos (Cavaleiro, Bruxa, Fera, Necromante, Colosso, Serpe, Olho, Duelista, Rainha-Aranha), com 18 ataques diferentes, segunda fase com 50% de vida e quebra de postura.
- Depois do primeiro ciclo, os chefes ganham nomes, cores, ataques extras e modificadores aleatórios (Colossal, Veloz, Ardente, Sombrio, Gêmeos).
- Almas: gaste na fogueira em Vigor, Fôlego e Força. Ao morrer, você as perde, mas pode recuperá-las no local da morte.
- O progresso é salvo automaticamente.

Controles no PC (testar no navegador abrindo `web/index.html`): WASD mover, J ataque, K forte, Espaço rolar, E curar, Q mira, Esc pausa.

## Compilar
```
./build.sh
```
Requer JDK 17+, Android SDK (`platforms;android-34`, `build-tools;35.0.0`) e Python 3 com Pillow. Não usa Gradle.
