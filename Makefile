tgen-all:
	tcardgen -o static/tcard -f static/assets/font -c config/config.yml content/posts/*.md

tgen-diff:
	git diff --name-only HEAD content/posts |\
  	xargs tcardgen -o static/tcard -f static/assets/font -c config/config.yml