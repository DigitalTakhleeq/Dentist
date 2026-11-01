#!/usr/bin/env bash
# Optional: make the site fully self-contained by downloading every Pexels photo locally.
# Run on YOUR computer (not needed for the demo to work online):   bash download-images.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets/img

# 1) collect every Pexels photo id used in the site
ids=$(grep -ho 'pexels-photo-[0-9]*' index.html js/main.js | sed 's/pexels-photo-//' | sort -u)

# 2) download each one (1600px wide is plenty)
for id in $ids; do
  echo "Downloading $id"
  curl -fsSL "https://images.pexels.com/photos/$id/pexels-photo-$id.jpeg?auto=compress&cs=tinysrgb&w=1600" -o "assets/img/$id.jpg"
done

# 3) point the site at the local copies
sed -i.bak -E 's#https://images\.pexels\.com/photos/([0-9]+)/pexels-photo-[0-9]+\.jpeg\?[^"]*#assets/img/\1.jpg#g' index.html
sed -i.bak -E 's#const px = id => `https://images[^`]*`;#const px = id => `assets/img/${id}.jpg`;#' js/main.js
rm -f index.html.bak js/main.js.bak
echo "Done. Photos are in assets/img and the site now loads them locally."
