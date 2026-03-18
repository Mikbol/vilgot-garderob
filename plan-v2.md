# Vilgots Garderob v2: Implementationsplan

## 1. Ta bort login/password gate
- Radera `#gate` div, `checkPass()`, SHA-256 logik, sessionStorage
- Visa `#content` direkt (ta bort `.visible`-klass-logik)
- Behåll confetti som välkomst-animation istället

## 2. Köp-knapp istället för helkorts-länk
- Ta bort `<a>` wrapper runt varje kort
- Lägg till en `<a class="buy-btn">Köp</a>` i `.card-body` med `target="_blank"`
- Styla knappen: guld/accent, hover-effekt, tydlig CTA
- Kortet blir klickbart för att visa detaljer men navigerar inte bort

## 3. Fixa H&M-bilder
- H&M blockerar hotlinking, nuvarande kort använder gradient-divs
- Strategi: Sök H&M-produktbilder via websök, ladda ner lokalt till `img/hm-*.jpg`
- 6 H&M-kort som behöver riktiga bilder

## 4. Fixa övriga trasiga bilder
- Verifiera alla `img/`-filer att de är riktiga bilder (inte HTML error pages)
- Ladda ner ersättningar för eventuellt trasiga

## 5. Bildkarusell (swipe/pilar)
- Ren CSS/JS implementation, inga externa libs
- Data-attribut: `data-images="img/a.jpg,img/b.jpg,img/c.jpg"`
- Mobil: swipe med touch events
- Desktop: vänster/höger-pilar
- Dots-indikator under bilden
- Bara visa pilar/dots om >1 bild finns

## 6. Cron-jobb: auto-hämta nya produkter
- Shell-skript som körs via macOS `launchd` (eller cron)
- Anropar Claude Code i headless-mode med prompt:
  - "Sök gentleman babykläder, ladda ner bilder, uppdatera index.html, pusha"
- Dedup via produktnamn/URL i HTML (grep innan insert)
- Kör t.ex. 1x/vecka
- Tema-filter: bara kostym, frack, slips, fluga, hängslen, vest, smoking

## 7. Fler källor & produkter
- Temu: sök "baby suit formal", "baby tuxedo", "infant gentleman"
- Lazada: sök samma termer (asiatisk marknad, billigare)
- Shein: baby formal wear
- AliExpress: gentleman baby romper
- Zara Baby: dressat sortiment
- Next (UK): formal baby
- Ladda ner bilder, skapa kort med pris + länk

## Prioritetsordning
1. Ta bort login (snabbt, öppnar för allt annat)
2. Köp-knapp (UI-förändring)
3. Fixa trasiga bilder (H&M + övriga)
4. Bildkarusell
5. Hämta fler produkter (Temu, Lazada m.fl.)
6. Cron-jobb (sist, bygger på fungerande site)
