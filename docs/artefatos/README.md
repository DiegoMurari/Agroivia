# Artefatos do projeto

| Artefato | Documento | Fonte editável | Imagem |
|---|---|---|---|
| Business Model Canvas | [bmc.md](bmc.md) | o próprio texto | `img/bmc.png` |
| Casos de uso (UML) | [casos-de-uso.md](casos-de-uso.md) | [casos-de-uso.puml](casos-de-uso.puml) | `img/cu-1-acesso.png` a `cu-6-painel.png` |
| Processo proposto (BPMN 2.0) | [processo-bpmn.md](processo-bpmn.md) | [processo.bpmn](processo.bpmn) | `img/processo-bpmn.png`, `img/processo-bpmn.svg` |
| DER (modelo de dados) | [der.md](der.md) | blocos Mermaid + [der-5.puml](der-5.puml) | `img/der-1.png` a `der-5.png` |
| Estados do agendamento | [estados.md](estados.md) | [estados.puml](estados.puml) | `img/estados-agendamento.png` |
| Matriz de rastreabilidade | [rastreabilidade.md](rastreabilidade.md) | — | — |
| Relatório gerencial | [../relatorio.md](../relatorio.md) | — | `img/*.svg` |
| Pitch | [../pitch.md](../pitch.md) | — | — |

## Como regenerar as imagens

PlantUML 1.2024.7 com o layout interno (sem Graphviz):

```
java -jar plantuml.jar -tpng -charset UTF-8 -o img casos-de-uso.puml estados.puml der-5.puml
```

O BPMN (`processo.bpmn`, SVG e PNG) foi gerado por um script a partir de um único modelo de raias, tarefas e fluxos, então o XML e a imagem não divergem. O arquivo `.bpmn` abre no bpmn.io, no Camunda Modeler e em qualquer ferramenta BPMN 2.0.
