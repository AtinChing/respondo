# Security Manual Documents

Place the documents you want indexed into Chroma in this folder.

Supported file types:

- `.txt`
- `.md`
- `.pdf`
- `.jsonl`

The Railtracks bridge will chunk these files and attach metadata such as source path, filename, file extension, and chunk index before storing them in the vector DB.

For `.jsonl`, each line is treated as a pre-chunked record. Supported fields:

- `id`: optional stable chunk id
- `content`, `text`, or `document`: the chunk text
- `metadata`: optional object that will be merged into stored chunk metadata
