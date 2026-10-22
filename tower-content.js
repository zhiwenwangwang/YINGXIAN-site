// Architectural facts: https://whc.unesco.org/en/tentativelists/5803/
// Keep copy separate from the mirrored renderer; apply before UI meshes exist.
export const heritageSource = 'https://whc.unesco.org/en/tentativelists/5803/';

export function configureTowerContent(config) {
  const middleTemplate=config.cubes[1];
  config.cubes.push({
    ...middleTemplate,
    interior:{
      ...middleTemplate.interior,
      social:middleTemplate.interior.social.map(item=>({...item})),
      links:middleTemplate.interior.links.map(item=>({...item})),
    },
  });
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
      title: 'STRUCTURE_02 Upper Tower Body', hash: 'upper-tower-body',
      content: 'The upper half brings together the fourth and third storeys. Repeating octagonal galleries step inward as they rise, while brackets transfer the broad roof loads into a dense timber frame.\n\nExplore the upper body as one connected assembly: paired galleries, columns and layered dougong reveal how the pagoda carries its weight without nails as its principal structural system.',
    },
    {
      title: 'STRUCTURE_03 Lower Tower Body', hash: 'lower-tower-body',
      content: 'The lower half joins the first and second storeys to the broad ground-level base. Its larger galleries and closely spaced columns support the stacked levels above while opening the building to the surrounding landscape.\n\nThe lower frame anchors the whole pagoda. Follow the transition from the base platform through the first two timber storeys to see how its load-bearing rhythm grows upward.',
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
