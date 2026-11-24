/* Service worker: põe a aplicação em cache para ela abrir sem rede.

   Estratégia — «servir da cache e atualizar por trás» (stale-while-revalidate)
   em vez de ir primeiro à rede. A aplicação é um ficheiro de perto de um
   megabyte, e ir sempre à rede primeiro fazia esperar por ele mesmo havendo
   uma cópia boa guardada: num telemóvel com rede fraca isso é a diferença
   entre abrir num instante e abrir daqui a nada. A cópia nova fica guardada
   para a abertura seguinte, que é o preço honesto desta escolha — vê-se a
   versão de ontem uma vez, e a de hoje logo a seguir.

   Só trata do que é da própria origem: pedidos para fora, se algum dia
   houver, passam ao lado sem serem tocados. */
const CACHE = "orcamento-familiar-v3";   // 2.0.0 — muda a cada versão, para a cópia antiga sair
const ATIVOS = ["./", "./index.html", "./orcamento-familiar.html", "./manifest.json",
  "./icones/icone-192.png", "./icones/icone-512.png", "./icones/icone-512-mascara.png"];

self.addEventListener("install", (e) => {
  /* `addAll` falha inteiro se um dos ficheiros faltar. Vão um a um, para que
     a ausência de um — o index.html, por exemplo, em quem só guardou a
     aplicação — não deixe a instalação toda por fazer. */
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ATIVOS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((guardada) => {
        const daRede = fetch(req)
          .then((res) => {
            // Só se guarda o que veio bem: uma página de erro em cache seria pior
            if (res && res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => null);
        // Havendo cópia, é ela que responde; a rede atualiza para a próxima vez
        if (guardada) return guardada;
        return daRede.then((res) => res || cache.match("./orcamento-familiar.html"));
      })
    )
  );
});

/* A aplicação pode pedir que se largue a versão antiga sem esperar pelo
   fecho de todos os separadores. */
self.addEventListener("message", (e) => {
  if (e.data === "atualizar-ja") self.skipWaiting();
});
