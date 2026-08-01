FROM golang:1.24-bookworm AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /out/verify-loop ./cmd/verify-loop

FROM debian:bookworm-slim
COPY --from=build /out/verify-loop /usr/local/bin/verify-loop
ENTRYPOINT ["/usr/local/bin/verify-loop"]
