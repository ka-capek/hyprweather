# AUR balíček `hyprweather-bin`

Bere hotový AppImage z vydání na GitHubu a rozbalí ho do `/opt/hyprweather`.
Nic se nekompiluje, takže instalace je jen stažení a rozbalení.

## Nová verze

```sh
./update.sh 0.2.0        # pkgver + kontrolní součet z vydání + .SRCINFO
makepkg -si              # zkouška na tomhle stroji, než se to pošle do AUR
```

`update.sh` počítá součet ze skutečně staženého souboru, takže vydání
**musí být na GitHubu dřív**, než se balíček aktualizuje.

## První odeslání do AUR

Jednorázově, vyžaduje účet na [aur.archlinux.org](https://aur.archlinux.org)
a nahraný veřejný SSH klíč (Account → My Account → SSH Public Key):

```sh
git clone ssh://aur@aur.archlinux.org/hyprweather-bin.git aur-hyprweather
cd aur-hyprweather
cp ../packaging/aur/{PKGBUILD,.SRCINFO} .
git add PKGBUILD .SRCINFO
git commit -m "Add hyprweather-bin 0.1.0"
git push
```

AUR přijímá jen `PKGBUILD` a `.SRCINFO` (plus případné `.install` a patche),
nic jiného v tom repozitáři být nemá. Jméno gitového repozitáře musí přesně
odpovídat `pkgname`.

Po přidání se balíček instaluje běžně: `yay -S hyprweather-bin`.

## Údržba

- Každé nové vydání = `./update.sh <verze>`, zkouška `makepkg -si`, commit
  a push do AUR repozitáře.
- `pkgrel` se zvyšuje jen při změně samotného balíčku beze změny verze aplikace.
- Závislosti odpovídají knihovnám, proti kterým je Electron slinkovaný
  (odvozeno z `ldd`); při skoku na novou verzi Electronu je projdi znovu.
