const lerp = (a, b, alpha) => a + alpha * (b - a)

export const moveElementWithEase = (
    element,
    prevX,
    prevY,
    currentX,
    currentY,
    duration
) => {
    const deltaX = currentX - prevX
    const deltaY = currentY - prevY

    const animate = (element, startX, endX, duration) => {
        const startTime = performance.now()

        const step = (currentTime) => {
            const elapsedTime = currentTime - startTime
            const t = Math.min(elapsedTime / duration, 1) // 0 ~ 1

            const currentX = lerp(startX, endX, t)
            element.style.transform = `translateX(${currentX}px)`

            if (t < 1) {
                requestAnimationFrame(step)
            }
        }

        requestAnimationFrame(step)
    }

    animate(element, 0, 200, 1000) // 0px에서 200px까지 1초 동안 이동
}
