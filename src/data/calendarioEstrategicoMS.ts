export interface EventoEstrategico {
  id: string; // Crie um slug único baseado no nome. Ex: 'aniv-dourados', 'dia-do-trabalho'
  title: string; // Nome da cidade ou da data comemorativa
  date: string; // Formato ISO estrito: 'YYYY-MM-DD'
  type: 'Aniversário da Cidade' | 'Data Comemorativa'; // Classifique lendo a linha do CSV
  color: string; // Use 'blue-500' para Aniversários de Cidades e 'purple-500' para Datas Comemorativas (bata com o Tailwind)
}

export const eventosMS2026: EventoEstrategico[] = [
  {
    id: 'dia-internacional-da-mulher',
    title: `Dia Internacional da Mulher`,
    date: '2026-03-08',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-bibliotecario',
    title: `Dia do Bibliotecário`,
    date: '2026-03-12',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-antonio-joao',
    title: `Aniversário de Antônio João`,
    date: '2026-03-18',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-carpinteiro-e-marceneiro',
    title: `Dia do Carpinteiro e Marceneiro`,
    date: '2026-03-19',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-ribas-do-rio-pardo',
    title: `Aniversário de Ribas do Rio Pardo`,
    date: '2026-03-19',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-coxim',
    title: `Aniversário de Coxim`,
    date: '2026-03-19',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-ponta-pora',
    title: `Aniversário de Ponta Porã`,
    date: '2026-03-19',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'padroeiro-de-cassilandia',
    title: `Padroeiro de Cassilândia`,
    date: '2026-03-19',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'ponto-facultativo',
    title: `Ponto Facultativo`,
    date: '2026-04-02',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'sexta-feira-santapaixao-de-cristo',
    title: `Sexta-feira Santa/Paixão de Cristo`,
    date: '2026-04-03',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-iguatemi',
    title: `Aniversário de Iguatemi`,
    date: '2026-04-08',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-nioaque',
    title: `Aniversário de Nioaque`,
    date: '2026-04-08',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-coxim-1',
    title: `Aniversário de Coxim`,
    date: '2026-04-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-aral-moreira',
    title: `Aniversário de Aral Moreira`,
    date: '2026-04-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-indio',
    title: `Dia do Índio`,
    date: '2026-04-19',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-nova-andradina',
    title: `Aniversário de Nova Andradina`,
    date: '2026-04-20',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'tiradentes',
    title: `Tiradentes`,
    date: '2026-04-21',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-agente-de-viagem',
    title: `Dia do Agente de Viagem`,
    date: '2026-04-22',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-laguna-carapa',
    title: `Aniversário de Laguna Carapã`,
    date: '2026-04-22',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-alcinopolis',
    title: `Aniversário de Alcinópolis`,
    date: '2026-04-22',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-brasilandia',
    title: `Aniversário de Brasilândia`,
    date: '2026-04-25',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-japora',
    title: `Aniversário de Japorã`,
    date: '2026-04-30',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-nova-andradina-1',
    title: `Aniversário de Nova Andradina`,
    date: '2026-04-30',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-novo-horizonte-do-sul',
    title: `Aniversário de Novo Horizonte do Sul`,
    date: '2026-04-30',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-trabalhador',
    title: `Dia do Trabalhador`,
    date: '2026-05-01',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-caracol',
    title: `Aniversário de Caracol`,
    date: '2026-05-01',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-gloria-de-dourados',
    title: `Aniversário de Glória de Dourados`,
    date: '2026-05-02',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-inocencia',
    title: `Aniversário de Inocência`,
    date: '2026-05-04',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-anastacio',
    title: `Aniversário de Anastácio`,
    date: '2026-05-08',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-terenos',
    title: `Aniversário de Terenos`,
    date: '2026-05-08',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-rio-negro',
    title: `Aniversário de Rio Negro`,
    date: '2026-05-09',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-das-maes',
    title: `Dia das Mães`,
    date: '2026-05-10',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-costa-rica',
    title: `Aniversário de Costa Rica`,
    date: '2026-05-12',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-douradina',
    title: `Aniversário de Douradina`,
    date: '2026-05-12',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-sao-gabriel-do-oeste',
    title: `Aniversário de São Gabriel do Oeste`,
    date: '2026-05-12',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-selviria',
    title: `Aniversário de Selvíria`,
    date: '2026-05-12',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-taquarussu',
    title: `Aniversário de Taquarussu`,
    date: '2026-05-12',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-angelica',
    title: `Aniversário de Angélica`,
    date: '2026-05-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-bodoquena',
    title: `Aniversário de Bodoquena`,
    date: '2026-05-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-deodapolis',
    title: `Aniversário de Deodápolis`,
    date: '2026-05-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-eldorado',
    title: `Aniversário de Eldorado`,
    date: '2026-05-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-itaquirai',
    title: `Aniversário de Itaquiraí`,
    date: '2026-05-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-mundo-novo',
    title: `Aniversário de Mundo Novo`,
    date: '2026-05-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-sete-quedas',
    title: `Aniversário de Sete Quedas`,
    date: '2026-05-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-tacuru',
    title: `Aniversário de Tacuru`,
    date: '2026-05-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-zootecnista',
    title: `Dia do Zootecnista`,
    date: '2026-05-13',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-jardim',
    title: `Aniversário de Jardim`,
    date: '2026-05-14',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-assistente-social',
    title: `Dia do Assistente Social`,
    date: '2026-05-15',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-apicultor',
    title: `Dia do Apicultor`,
    date: '2026-05-22',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-coronel-sapucaia',
    title: `Aniversário de Coronel Sapucaia`,
    date: '2026-05-24',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-trabalhador-rural',
    title: `Dia do Trabalhador Rural`,
    date: '2026-05-25',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-amambai',
    title: `Aniversário de Amambai`,
    date: '2026-05-28',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-porto-murtinho',
    title: `Aniversário de Porto Murtinho`,
    date: '2026-06-03',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-sonora',
    title: `Aniversário de Sonora`,
    date: '2026-06-03',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'corpus-christi',
    title: `Corpus Christi`,
    date: '2026-06-04',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'corpus-christi-ponto-facultativo',
    title: `Corpus Christi (Ponto Facultativo)`,
    date: '2026-06-05',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-maracaju',
    title: `Aniversário de Maracaju`,
    date: '2026-06-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-dos-namorados',
    title: `Dia dos Namorados`,
    date: '2026-06-12',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'retomada-de-corumba',
    title: `Retomada de Corumbá`,
    date: '2026-06-13',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'padroeiro-de-campo-grande',
    title: `Padroeiro de Campo Grande`,
    date: '2026-06-13',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-tres-lagoas',
    title: `Aniversário de Três Lagoas`,
    date: '2026-06-15',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-bandeirantes',
    title: `Aniversário de Bandeirantes`,
    date: '2026-06-20',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-vicentina',
    title: `Aniversário de Vicentina`,
    date: '2026-06-20',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-revendedor',
    title: `Dia do Revendedor`,
    date: '2026-06-20',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-vigilante',
    title: `Dia do Vigilante`,
    date: '2026-06-20',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'banho-de-sao-joao',
    title: `Banho de São João`,
    date: '2026-06-23',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-de-sao-joao',
    title: `Dia de São João`,
    date: '2026-06-24',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-nacional-do-policial-e-bombeiro-militar',
    title: `Dia Nacional do Policial e Bombeiro Militar`,
    date: '2026-06-24',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-das-micro-pequenas-e-medias-empresas',
    title: `Dia das Micro, Pequenas e Médias Empresas`,
    date: '2026-06-27',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-bombeiro-brasileiro',
    title: `Dia do Bombeiro Brasileiro`,
    date: '2026-07-02',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-paranaiba',
    title: `Aniversário de Paranaíba`,
    date: '2026-07-04',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-fatima-do-sul',
    title: `Aniversário de Fátima do Sul`,
    date: '2026-07-09',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-nacional-do-pecuarista',
    title: `Dia Nacional do Pecuarista`,
    date: '2026-07-15',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-miranda',
    title: `Aniversário de Miranda`,
    date: '2026-07-16',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-ponta-pora-1',
    title: `Aniversário de Ponta Porã`,
    date: '2026-07-18',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-bela-vista',
    title: `Aniversário de Bela Vista`,
    date: '2026-07-20',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-motorista',
    title: `Dia do Motorista`,
    date: '2026-07-25',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-agricultor',
    title: `Dia do Agricultor`,
    date: '2026-07-28',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-cassilandia',
    title: `Aniversário de Cassilândia`,
    date: '2026-08-03',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-dos-pais',
    title: `Dia dos Pais`,
    date: '2026-08-09',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-estudante',
    title: `Dia do Estudante`,
    date: '2026-08-11',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-aquidauana',
    title: `Aniversário de Aquidauana`,
    date: '2026-08-15',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-campo-grande',
    title: `Aniversário de Campo Grande`,
    date: '2026-08-26',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-profissional-de-educacao-fisica',
    title: `Dia do Profissional de Educação Física`,
    date: '2026-09-01',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-ladario',
    title: `Aniversário de Ladário`,
    date: '2026-09-02',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-da-amazonia',
    title: `Dia da Amazônia`,
    date: '2026-09-05',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'independencia-do-brasil',
    title: `Independência do Brasil`,
    date: '2026-09-07',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-internacional-da-alfabetizacao',
    title: `Dia Internacional da Alfabetização`,
    date: '2026-09-08',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-programador',
    title: `Dia do Programador`,
    date: '2026-09-13',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-agronomo',
    title: `Dia do Agrônomo`,
    date: '2026-09-13',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-cliente',
    title: `Dia do Cliente`,
    date: '2026-09-15',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-corumba',
    title: `Aniversário de Corumbá`,
    date: '2026-09-21',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-da-arvore',
    title: `Dia da Árvore`,
    date: '2026-09-21',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'inicio-da-primavera',
    title: `Início da Primavera`,
    date: '2026-09-22',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-nacional-do-transito',
    title: `Dia Nacional do Trânsito`,
    date: '2026-09-25',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-mundial-do-turismo',
    title: `Dia Mundial do Turismo`,
    date: '2026-09-27',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-aparecida-do-taboado',
    title: `Aniversário de Aparecida do Taboado`,
    date: '2026-09-28',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-figueirao',
    title: `Aniversário de Figueirão`,
    date: '2026-09-29',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-camapua',
    title: `Aniversário de Camapuã`,
    date: '2026-09-30',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-paraiso-das-aguas',
    title: `Aniversário de Paraíso das Águas`,
    date: '2026-09-30',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-vendedor',
    title: `Dia do Vendedor`,
    date: '2026-10-01',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-nacional-do-vereador',
    title: `Dia Nacional do Vereador`,
    date: '2026-10-01',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-bonito',
    title: `Aniversário de Bonito`,
    date: '2026-10-02',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-mundial-do-dentista',
    title: `Dia Mundial do Dentista`,
    date: '2026-10-03',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-agente-comunitario-de-saude',
    title: `Dia do Agente Comunitário de Saúde`,
    date: '2026-10-04',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-mundial-dos-professores',
    title: `Dia Mundial dos Professores`,
    date: '2026-10-05',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-prefeito',
    title: `Dia do Prefeito`,
    date: '2026-10-06',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-empresario-brasileiro',
    title: `Dia do Empresário Brasileiro`,
    date: '2026-10-10',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'criacao-do-estado-de-ms',
    title: `Criação do Estado de MS`,
    date: '2026-10-11',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'nossa-senhora-aparecida',
    title: `Nossa Senhora Aparecida`,
    date: '2026-10-12',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-engenheiro-agronomo',
    title: `Dia do Engenheiro Agrônomo`,
    date: '2026-10-12',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-dos-professores',
    title: `Dia dos Professores`,
    date: '2026-10-15',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-do-medico',
    title: `Dia do Médico`,
    date: '2026-10-18',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-chapadao-do-sul',
    title: `Aniversário de Chapadão do Sul`,
    date: '2026-10-22',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-nova-alvorada-do-sul',
    title: `Aniversário de Nova Alvorada do Sul`,
    date: '2026-10-27',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-do-servidor-publico',
    title: `Dia do Servidor Público`,
    date: '2026-10-28',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'finados',
    title: `Finados`,
    date: '2026-11-02',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-anaurilandia',
    title: `Aniversário de Anaurilândia`,
    date: '2026-11-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-ivinhema',
    title: `Aniversário de Ivinhema`,
    date: '2026-11-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-jatei',
    title: `Aniversário de Jateí`,
    date: '2026-11-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-navirai',
    title: `Aniversário de Naviraí`,
    date: '2026-11-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-pedro-gomes',
    title: `Aniversário de Pedro Gomes`,
    date: '2026-11-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-bataypora',
    title: `Aniversário de Batayporã`,
    date: '2026-11-12',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-dois-irmaos-do-buriti',
    title: `Aniversário de Dois Irmãos do Buriti`,
    date: '2026-11-13',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'proclamacao-da-republica',
    title: `Proclamação da República`,
    date: '2026-11-15',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-paranhos',
    title: `Aniversário de Paranhos`,
    date: '2026-11-17',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-da-bandeira',
    title: `Dia da Bandeira`,
    date: '2026-11-19',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'dia-nacional-da-consciencia-negra',
    title: `Dia Nacional da Consciência Negra`,
    date: '2026-11-20',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-rochedo',
    title: `Aniversário de Rochedo`,
    date: '2026-11-23',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'dia-da-familia',
    title: `Dia da Família`,
    date: '2026-12-08',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-itapora',
    title: `Aniversário de Itaporã`,
    date: '2026-12-10',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-bataguassu',
    title: `Aniversário de Bataguassu`,
    date: '2026-12-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-corguinho',
    title: `Aniversário de Corguinho`,
    date: '2026-12-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-sidrolandia',
    title: `Aniversário de Sidrolândia`,
    date: '2026-12-11',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-jaraguari',
    title: `Aniversário de Jaraguari`,
    date: '2026-12-12',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-juti',
    title: `Aniversário de Juti`,
    date: '2026-12-14',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-rio-verde-de-mato-grosso',
    title: `Aniversário de Rio Verde de Mato Grosso`,
    date: '2026-12-16',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-santa-rita-do-pardo',
    title: `Aniversário de Santa Rita do Pardo`,
    date: '2026-12-18',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-caarapo',
    title: `Aniversário de Caarapó`,
    date: '2026-12-20',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'aniversario-de-dourados',
    title: `Aniversário de Dourados`,
    date: '2026-12-20',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'vespera-de-natal',
    title: `Véspera de Natal`,
    date: '2026-12-24',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'natal',
    title: `Natal`,
    date: '2026-12-25',
    type: 'Data Comemorativa',
    color: 'purple-500'
  },
  {
    id: 'aniversario-de-rio-brilhante',
    title: `Aniversário de Rio Brilhante`,
    date: '2026-12-26',
    type: 'Aniversário da Cidade',
    color: 'blue-500'
  },
  {
    id: 'vespera-de-ano-novo',
    title: `Véspera de Ano Novo`,
    date: '2026-12-31',
    type: 'Data Comemorativa',
    color: 'purple-500'
  }
];
