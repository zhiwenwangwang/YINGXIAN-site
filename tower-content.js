// Architectural facts: https://whc.unesco.org/en/tentativelists/5803/
// Keep copy separate from the mirrored renderer; apply before UI meshes exist.
export const heritageSource = 'https://whc.unesco.org/en/tentativelists/5803/';

export function configureTowerContent(config) {
  config.manifesto = {
    title: '////// Yingxian',
    text: 'Built in 1056. An octagonal timber pagoda in Shanxi, China. Explore its crown, layered structure and inner frame.',
  };
  config.copyright = '// Liao Dynasty / 1056';
  config.rights = 'Yingxian Wooden Pagoda\nShanxi, China.';
  config.scroll = 'Scroll down to explore.';
  config.follow = '/// Explore the Pagoda';
  config.click = 'Explore this structure';
  config.social = [{ name: 'Heritage', link: heritageSource }];

  const subjects = [
    {
      title: 'STRUCTURE_01 Tower Crown', hash: 'tower-crown',
      content: 'The crown brings the fifth visible storey, its sweeping roof and the finial into one composition. Eight sides converge toward the summit, completing the silhouette of the Yingxian Wooden Pagoda.\n\nBuilt in 1056 during the Liao dynasty, the pagoda rises 67.31 metres. This view isolates the upper structure from the supplied architectural model, revealing the relationship between roof, columns and supporting timber members.',
    },
    {
      title: 'STRUCTURE_02 Middle Storey', hash: 'middle-storey',
      content: 'The middle storey reveals the repeated octagonal order of the pagoda. Columns, beams and bracket assemblies form a layered timber framework beneath the projecting roof.\n\nThe building has five visible storeys and four concealed structural levels. This third-storey model brings the outer gallery, roof and internal supports into view, inviting a closer look at how individual members form a coherent architectural whole.',
    },
  ];
  config.cubes.forEach((cube,i) => {
    const subject=subjects[i];
    Object.assign(cube,{title:subject.title,hash:subject.hash,date:'1056 AD'});
    Object.assign(cube.interior,{
      title:'////// Yingxian Wooden Pagoda',content:subject.content,
      socialTitle:'/// Context',social:[{name:'Heritage',link:heritageSource}],
      linkTitle:'/// Read more',links:[{name:'Architectural record',link:heritageSource}],
    });
  });
  // LinkedIn / X / M slots are now architectural subjects, in their original order.
  ['Whole Pagoda','Middle Storey','Tower Crown'].forEach((title,i) => {
    config.links[i].title=title;
    config.links[i].url=heritageSource;
    config.links[i].scale=1;
  });
}
