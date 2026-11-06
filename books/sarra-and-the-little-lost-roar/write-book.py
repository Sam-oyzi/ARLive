import json
from pathlib import Path
root=Path(__file__).parent
entries=[
('Sarra and the Little Lost Roar','A listening adventure for Sarra.','Sarra et le petit rugissement','Une aventure à écouter, pour Sarra.'),
('A sound in the hedge','Sarra loved the elephant’s trumpet.\nShe loved the owl’s soft call.\nBut under the garden hedge…\n\n*Pip?*','Un bruit dans la haie','Sarra aimait les cris d’éléphant.\nElle aimait le chant du hibou.\nMais tout près de la haie…\n\n*Piou ?*'),
('The little lost roar','A lion! A very little lion.\n“My roar has gone,” he whispered.\n“Will you help me find it?”\n\nWould you listen too?','Le petit rugissement perdu','Un lion ! Un tout petit lion.\n« Mon rugissement a disparu.\nTu m’aides à le retrouver ? »\n\nEt toi, tu l’écouterais ?'),
('Louder is not always better','“Try mine!” said Elephant.\n\n*PAAAR-PAAA!*\n\nThe trees shook. The cub squeaked.\nThat wasn’t his roar.','Plus fort ne suffit pas','« Essaie ma voix ! » dit Éléphant.\n\n*POUÊÊÊT !*\n\nLes arbres tremblèrent. Le lion couina.\nCe n’était pas son rugissement.'),
('Rabbit listens','“Shall we try being quiet?”\nRabbit folded one soft ear.\nThey heard a beetle’s tiny feet…\n\nThen something farther away.','Lapin tend l’oreille','« Et si on écoutait doucement ? »\nLapin replia sa longue oreille.\nIls entendirent les pas d’un scarabée…\n\nPuis un bruit, plus loin.'),
('Owl knows a little secret','“Perhaps your roar isn’t lost,”\nOwl said, soft as feathers.\n“Perhaps it’s feeling small.”\n\nSarra held the little paw.','Le petit secret du hibou','« Ton rugissement n’est peut-être pas perdu,\ndit Hibou tout doucement.\nIl se sent peut-être tout petit. »\n\nSarra prit la petite patte.'),
('Listen by the water','They listened to the leaves.\nThey listened to the brook.\n\n*Plip. Plop. “Help?”*\n\nWho was calling now?','Une voix près de l’eau','Ils écoutèrent les feuilles.\nIls écoutèrent le ruisseau.\n\n*Plip. Plop. « Au secours ? »*\n\nQui appelait, cette fois ?'),
('The other side','One little tortoise waited.\nThe stepping stones were gone.\n“My home is over there.”\n\nCould small friends do big things?','De l’autre côté','Une petite tortue attendait.\nLes pierres du passage avaient disparu.\n« Ma maison est là-bas… »\n\nLes petits peuvent-ils faire de grandes choses ?'),
('A bridge made of friends','Elephant held a fallen branch.\nRabbit tucked the twigs in tight.\nOwl showed the safest way.\n\nBut someone still felt small.','Un pont fait d’amitié','Éléphant posa une grande branche.\nLapin coinça les petites brindilles.\nHibou montra le meilleur chemin.\n\nMais quelqu’un se sentait encore petit.'),
('One brave little word','“I can’t roar,” whispered Lion.\n“Just try a little,” Sarra said.\nTortoise took one wobbly step.\n\n“You can do it!” called…','Un tout petit mot courageux','« Je ne sais pas rugir… »\n« Essaie doucement », dit Sarra.\nTortue fit un pas hésitant.\n\n« Tu peux y arriver ! » cria…'),
('A roar that says I am here','…Lion!\n\n*ROAAR!*\n\nNot a roar to frighten.\nA roar that said, “I’m here!”','Un rugissement pour rassurer','…Lion !\n\n*ROAAAR !*\n\nPas pour faire peur.\nPour dire : « Je suis là ! »'),
('The quiet way home','“You found it!” Sarra smiled.\n“You listened,” Lion said.\nThe loud world grew soft again.\n\nHome was just beyond the gate.','Le retour tout doux','« Tu l’as retrouvé ! » sourit Sarra.\n« Tu m’as écouté », dit Lion.\nLe grand monde redevint tout doux.\n\nLa maison était derrière le portail.'),
('Small voices matter','That night, Sarra listened.\nA breeze. A bird. Her heartbeat.\nEven little voices matter.\n\nWho will you listen to?','Les petites voix comptent','Ce soir-là, Sarra écouta.\nLe vent. Un oiseau. Son cœur.\nMême les petites voix comptent.\n\nEt toi, qui écouteras-tu ?')]
# Ten spreads: each addition develops listening, empathy, choice, or the resolution.
new_a=[
('A voice borrowed from a bird','A songbird sang a silver song.\nThe cub tried singing too.\n\n*Pip. Pip. PIP!*\n\nBut something still felt wrong.','La chanson de l’oiseau','Un oiseau chanta sa jolie chanson.\nLe lion essaya lui aussi.\n\n*Piou. Piou. PIOU !*\n\nMais quelque chose n’allait pas.'),
('A voice of your own','“That song belongs to Bird,”\nSarra said. “Yours belongs to you.”\nThe cub gave one small smile.\n\nWould you listen too?','Une voix rien qu’à toi','« C’est la chanson de l’oiseau.\nTa voix, elle est à toi. »\nLe lion fit un petit sourire.\n\nEt toi, tu l’écouterais ?')]
new_b=[
('Small, just like me','“That voice sounds small,” said Lion.\n“Small, just like me.”\n“Then let’s be gentle,” Sarra said.\n\n“Let’s find who needs a friend.”','Une petite voix, comme moi','« Cette voix est toute petite.\nPetite, comme moi », dit Lion.\n« Alors, allons tout doucement.\nCherchons qui a besoin d’un ami. »'),
('Two friends follow the footprints','Two friends followed tiny footprints.\nPast a fern. Around a stone.\nThe small voice called once more…\n\nThis time, it wasn’t alone.','Deux amis suivent les traces','Deux amis suivirent de petites traces.\nUne fougère. Un caillou.\nLa petite voix appela encore…\n\nMais elle n’était plus seule.')]
new_c=[
('One foot, then a pause','Tortoise tried one careful step.\nThen paused along the way.\n“What if I’m not brave enough?”\n\nThe cub knew that feeling.','Un pas, puis une pause','Tortue essaya un premier pas.\nPuis elle hésita encore un peu.\n« Et si je n’étais pas courageuse ? »\n\nLe lion connaissait ce sentiment.'),
('Beside a little friend','“You needn’t be the biggest,”\nSarra whispered to the cub.\n“Could you stay beside your friend?”\n\nLion stepped a little closer.','Tout près de son ami','« Pas besoin d’être le plus grand,\nsouffla Sarra au petit lion.\nTu peux rester près de ton amie. »\n\nLion fit un pas vers Tortue.')]
new_d=[
('Across, together','Four small feet reached the moss.\nTortoise turned and beamed.\n“Your little voice helped me!”\n\nEveryone leaned in to listen.','De l’autre côté, ensemble','Quatre petites pattes touchèrent la mousse.\nTortue se retourna, toute souriante.\n« Ta petite voix m’a aidée ! »\n\nTous s’approchèrent pour l’écouter.'),
('The gift of listening','“Was my roar here all along?”\nLion asked. Sarra nodded.\n“Sometimes brave things start quietly.”\n\nWould you listen too?','Le cadeau d’écouter','« Mon rugissement était là depuis toujours ? »\nSarra fit oui de la tête.\n« Le courage commence parfois tout doucement. »\n\nEt toi, tu l’écouterais ?')]
entries=entries[:5]+new_a+entries[5:7]+new_b+entries[7:9]+new_c+entries[9:11]+new_d+entries[11:]
assert len(entries)==21
experiences=json.loads((root/'experience.json').read_text(encoding='utf-8'))
ar={entry['page']-1 for entry in experiences['arPages']}
pages=[]
for i,(title,story,frtitle,frstory) in enumerate(entries):
 p={'file':'cover.png' if i==0 else f'spread-{(i+1)//2:02}.png','title':title,'story':story,'textPosition':'off' if i==0 else 'top','ar':i in ar,'translations':{'fr':{'title':frtitle,'story':frstory}}}
 if i:p['side']='left' if i%2 else 'right'
 else:p['translations']['fr']['imageUrl']='/book-art/sarra-and-the-little-lost-roar/fr-page-01.jpg'
 pages.append(p)
 for lang,words in [('en',story),('fr',frstory)]:
  assert len(words)<1000
 assert len(title)<120
(root/'pages.json').write_text(json.dumps({'pages':pages},ensure_ascii=False,indent=2)+'\n')
text=['# Sarra and the Little Lost Roar','\nA small voice. A big friendship.\n','Original read-aloud animal adventure for Sarra, approximately ages 4–7. English and French.','\n## Story and visual direction\n','Sarra does not solve the problem by making the cub louder. She listens, stays beside him, and lets his voice return when a friend needs encouragement. The refrain invites the child to listen, rather than delivering a lesson.','\nCream cold-press paper, loose fineliner, transparent sepia/sienna/indigo washes, sage and honey accents. Sarra wears a mustard pinafore, cream shirt and teal boots; the honey-gold cub has a small russet mane and teal scarf. Neither is based on a supplied portrait.','\nGelasio book serif for story lines, Fredoka for expressive sounds; use the app’s existing text compositor on quiet paper. No text embedded in spreads.','\n## Pages\n']
for i,p in enumerate(pages):
 text += [f'### {i+1}. {p["title"]}'+(' · AR target' if p['ar'] else ''),'',p['story'],'',f'Art: {p["file"]}'+(f' ({p["side"]})' if 'side'in p else '')+f'. Text: {p["textPosition"]}.','']
text+=['## AR choices\n']
for a in experiences['arPages']:text+=[f'- Page {a["page"]}: {a["purpose"]} Scanning: {a["scanAction"]}.']
text+=['\nDigital pages show Step Inside or Look around 360° according to experience.json. Printed pages compile from their artwork, with no words or badge inside the target. The compositor keeps lettering on quiet paper; verify recognition on matte printed proofs.','\n## Production\n','The images, manifests, original model and installer live together in this folder. Keep the book as a reviewable draft until the family chooses to share it. Do not seed accounts or reset any database.','\nFallback import: drop cover.png, all ten spread images and pages.json into the admin studio with two-page spreads enabled. Set Sketchbook 3:4, configure the eight experiences from experience.json, and compile. The generated installer handles this for the local app.']
(root/'plan.md').write_text('\n'.join(text)+'\n')
print('Wrote 21-page bilingual story, plan and experience manifest.')
