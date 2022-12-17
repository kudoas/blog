tgen-all:
	tcardgen -o static/tcard -f static/assets/font -c config/config.yml content/ja/posts/*.md

tgen-diff:
	git diff --name-only HEAD content/ja/posts |\
  	xargs tcardgen -o static/tcard -f static/assets/font -c config/config.yml
