export default class Chunker {
 
  static chunkItAll(str: string, lengthTrigger: number): string[] {
    if (str.length <= lengthTrigger) return [str];

    let splits = Math.floor(str.length / lengthTrigger) + 1;
    let chunkLengthAttempt = Math.floor(str.length / splits);

    let chunks = [str];
    chunks = Chunker.chunk(chunks, chunkLengthAttempt, "\n\n", null); // \n\n   null    \n
    chunks = Chunker.chunk(chunks, chunkLengthAttempt, "\n", "- "); //   \n     -_      \n
    chunks = Chunker.chunk(chunks, chunkLengthAttempt, ". ", null); //    .      _       .    It leaves the space in front of the split

    return chunks;
  }

  static chunk(
    chunks: string[],
    maxLength: number,
    token: string,
    followToken: string | null
  ): string[] {
    let output = [];
    for (let c of chunks) {
      if (c.length < maxLength) {
        output.push(c);
      } else {
        let chunks1 = c.split(token);

        if (chunks1.length == 1) {
          output.push(c);
        } else {
          let chunks2 = Chunker.rejoin(
            chunks1,
            maxLength,
            token,
            followToken
          );

          for (let k of chunks2) {
            output.push(k);
          }
        }
      }
    }
    return output;
  }

  static rejoin(
    chunks: string[],
    maxLength: number,
    rejoiner: string,
    followToken: string | null
  ): string[] {
    let accumulatedChunk = "";
    let chunks2: string[] = [];
    for (let c of chunks) {
      //leave SPLIT
      if (
        c.length + accumulatedChunk.length > maxLength &&
        (followToken == null || c.indexOf(followToken) == 0)
      ) {
        chunks2.push(accumulatedChunk);
        accumulatedChunk = c;
      }
      //JOIN
      else {
        if (accumulatedChunk == "") {
          accumulatedChunk = c;
        } else {
          accumulatedChunk += rejoiner + c;
        }
      }
    }
    chunks2.push(accumulatedChunk);

    console.log("Pass findings:" + chunks2.length);

    return chunks2;
  }
}
