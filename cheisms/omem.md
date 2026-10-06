# omem (optimized memory)

[references]
- ~/nousbase/main/MACHINE_LEARNING
- https://gist.github.com/VictorTaelin/91837951a5ce5b38f341ec1ba1df6449

*show us the context and we will show you the world*

>Think of a giant pool of text that fills up and eventually overflows the context length.
>LLMs are just text. Their world is only text, so they must learn to interact as text. 
>What if instead of slowly filling up the pool. You prefill the pool, the text becomes the world. The LLM changes the text to act out the world.

You leave a lot of blank space in this context world. The rest of the world is the tree view. 

Tree 
Zoom
Scratch Zone (Rest of context)
Logs (zoom in on memory bank)

There should be some degree of immutability to the context world, this helps with prompt caching, the world should be put into context in order of how much it changes from least to most.








