/*
 * shim_selftest.c - functional test of the interposed sync primitives.
 *
 * Run it twice: untraced (validates the test itself) and under the shim
 * (lp-run --tier F, which sets LD_PRELOAD + LP_TRACE_PATH). In both cases
 * every primitive must keep working: no hang, correct results, exit 0.
 *
 * Under the shim the Tier F trace must contain exactly the event counts this
 * program prints as "LPEXPECT <EVENT> <count>" lines (checked by
 * scripts/check_phase2.py). Counts that depend on scheduling (e.g. how often
 * a cond waiter really waits) are checked as relations there instead.
 *
 * Exit status: 0 ok, 1 a check failed.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <errno.h>
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static int g_failed;

#define CHECK(cond, ...)                                                                           \
    do {                                                                                           \
        if (!(cond)) {                                                                             \
            fprintf(stderr, "selftest FAIL %s:%d: ", __FILE__, __LINE__);                        \
            fprintf(stderr, __VA_ARGS__);                                                          \
            fputc('\n', stderr);                                                                   \
            g_failed = 1;                                                                          \
        }                                                                                          \
    } while (0)

static void die_rc(int rc, const char *what)
{
    if (rc != 0) {
        fprintf(stderr, "selftest: %s failed: %s\n", what, strerror(rc));
        exit(1);
    }
}

static struct timespec abs_after_ms(clockid_t clk, long ms)
{
    struct timespec ts;
    clock_gettime(clk, &ts);
    ts.tv_nsec += (ms % 1000) * 1000000L;
    ts.tv_sec += ms / 1000 + ts.tv_nsec / 1000000000L;
    ts.tv_nsec %= 1000000000L;
    return ts;
}

/* ---------------------------------------------------------------- mutex */

static pthread_mutex_t g_m = PTHREAD_MUTEX_INITIALIZER;

static void *trylock_helper(void *arg)
{
    (void)arg;
    int rc = pthread_mutex_trylock(&g_m); /* main holds g_m */
    CHECK(rc == EBUSY, "trylock on held mutex returned %d, expected EBUSY", rc);
    return NULL;
}

static void test_mutex(void)
{
    for (int i = 0; i < 100; i++) {
        die_rc(pthread_mutex_lock(&g_m), "lock");
        die_rc(pthread_mutex_unlock(&g_m), "unlock");
    }
    die_rc(pthread_mutex_lock(&g_m), "lock");
    pthread_t t;
    die_rc(pthread_create(&t, NULL, trylock_helper, NULL), "create");
    die_rc(pthread_join(t, NULL), "join");
    die_rc(pthread_mutex_unlock(&g_m), "unlock");
    int rc = pthread_mutex_trylock(&g_m);
    CHECK(rc == 0, "trylock on free mutex returned %d", rc);
    if (rc == 0)
        die_rc(pthread_mutex_unlock(&g_m), "unlock");
}

/* ------------------------------------------------- cond: producer/consumer */

#define PC_ITEMS 2000
#define PC_CONSUMERS 2

static pthread_mutex_t pc_m = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t pc_nonempty = PTHREAD_COND_INITIALIZER;
static int pc_count, pc_done;
static long pc_taken, pc_sum;

static void *pc_consumer(void *arg)
{
    (void)arg;
    for (;;) {
        die_rc(pthread_mutex_lock(&pc_m), "pc lock");
        while (pc_count == 0 && !pc_done)
            die_rc(pthread_cond_wait(&pc_nonempty, &pc_m), "pc cond_wait");
        if (pc_count == 0 && pc_done) {
            die_rc(pthread_mutex_unlock(&pc_m), "pc unlock");
            return NULL;
        }
        pc_count--;
        pc_taken++;
        pc_sum += pc_taken;
        die_rc(pthread_mutex_unlock(&pc_m), "pc unlock");
    }
}

static void test_cond_prodcons(void)
{
    pthread_t c[PC_CONSUMERS];
    for (int i = 0; i < PC_CONSUMERS; i++)
        die_rc(pthread_create(&c[i], NULL, pc_consumer, NULL), "create");
    for (int i = 0; i < PC_ITEMS; i++) {
        die_rc(pthread_mutex_lock(&pc_m), "lock");
        pc_count++;
        die_rc(pthread_cond_signal(&pc_nonempty), "cond_signal"); /* PC_ITEMS signals */
        die_rc(pthread_mutex_unlock(&pc_m), "unlock");
    }
    die_rc(pthread_mutex_lock(&pc_m), "lock");
    pc_done = 1;
    die_rc(pthread_cond_broadcast(&pc_nonempty), "cond_broadcast"); /* broadcast #1 */
    die_rc(pthread_mutex_unlock(&pc_m), "unlock");
    for (int i = 0; i < PC_CONSUMERS; i++)
        die_rc(pthread_join(c[i], NULL), "join");
    CHECK(pc_taken == PC_ITEMS, "consumed %ld items, expected %d", pc_taken, PC_ITEMS);
    CHECK(pc_sum == (long)PC_ITEMS * (PC_ITEMS + 1) / 2, "item checksum %ld", pc_sum);
}

/* ------------------------------------------------- cond: timedwait timeout */

static void test_cond_timedwait(void)
{
    pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
    pthread_cond_t c = PTHREAD_COND_INITIALIZER;
    die_rc(pthread_mutex_lock(&m), "lock");
    struct timespec ts = abs_after_ms(CLOCK_REALTIME, 20); /* default condattr clock */
    int rc;
    do {
        rc = pthread_cond_timedwait(&c, &m, &ts); /* nobody signals: must time out */
    } while (rc == 0);                          /* tolerate spurious wakeups */
    CHECK(rc == ETIMEDOUT, "cond_timedwait returned %d, expected ETIMEDOUT", rc);
    rc = pthread_mutex_unlock(&m); /* mutex must be held again after the timeout */
    CHECK(rc == 0, "unlock after cond_timedwait timeout returned %d", rc);
}

/* ------------------------------------------------------- cond: broadcast */

#define BC_WAITERS 4

static pthread_mutex_t bc_m = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t bc_c = PTHREAD_COND_INITIALIZER;
static int bc_go, bc_woken;

static void *bc_waiter(void *arg)
{
    (void)arg;
    die_rc(pthread_mutex_lock(&bc_m), "lock");
    while (!bc_go)
        die_rc(pthread_cond_wait(&bc_c, &bc_m), "cond_wait");
    bc_woken++;
    die_rc(pthread_mutex_unlock(&bc_m), "unlock");
    return NULL;
}

static void test_cond_broadcast(void)
{
    pthread_t t[BC_WAITERS];
    for (int i = 0; i < BC_WAITERS; i++)
        die_rc(pthread_create(&t[i], NULL, bc_waiter, NULL), "create");
    die_rc(pthread_mutex_lock(&bc_m), "lock");
    bc_go = 1;
    die_rc(pthread_cond_broadcast(&bc_c), "cond_broadcast"); /* broadcast #2 */
    die_rc(pthread_mutex_unlock(&bc_m), "unlock");
    for (int i = 0; i < BC_WAITERS; i++)
        die_rc(pthread_join(t[i], NULL), "join");
    CHECK(bc_woken == BC_WAITERS, "broadcast woke %d of %d", bc_woken, BC_WAITERS);
}

/* ------------------------------------------------------------- semaphores */

#define SEM_ROUNDS 1000

static sem_t sem_a, sem_b;

static void *sem_echo(void *arg)
{
    (void)arg;
    for (int i = 0; i < SEM_ROUNDS; i++) {
        if (sem_wait(&sem_a) != 0) {
            perror("selftest: sem_wait");
            exit(1);
        }
        if (sem_post(&sem_b) != 0) {
            perror("selftest: sem_post");
            exit(1);
        }
    }
    return NULL;
}

static void test_sem(void)
{
    if (sem_init(&sem_a, 0, 0) != 0 || sem_init(&sem_b, 0, 0) != 0) {
        perror("selftest: sem_init");
        exit(1);
    }
    pthread_t t;
    die_rc(pthread_create(&t, NULL, sem_echo, NULL), "create");
    for (int i = 0; i < SEM_ROUNDS; i++) {
        CHECK(sem_post(&sem_a) == 0, "sem_post a");
        CHECK(sem_wait(&sem_b) == 0, "sem_wait b");
    }
    die_rc(pthread_join(t, NULL), "join");

    sem_t s;
    if (sem_init(&s, 0, 0) != 0) {
        perror("selftest: sem_init");
        exit(1);
    }
    errno = 0;
    int rc = sem_trywait(&s); /* empty: EAGAIN */
    CHECK(rc == -1 && errno == EAGAIN, "sem_trywait on empty: rc=%d errno=%d", rc, errno);
    CHECK(sem_post(&s) == 0, "sem_post");
    rc = sem_trywait(&s);
    CHECK(rc == 0, "sem_trywait on posted: rc=%d errno=%d", rc, errno);

    struct timespec ts = abs_after_ms(CLOCK_REALTIME, 20);
    errno = 0;
    do {
        rc = sem_timedwait(&s, &ts); /* empty: must time out */
    } while (rc == -1 && errno == EINTR);
    CHECK(rc == -1 && errno == ETIMEDOUT, "sem_timedwait: rc=%d errno=%d", rc, errno);

    sem_destroy(&s);
    sem_destroy(&sem_a);
    sem_destroy(&sem_b);
}

/* ---------------------------------------------------------------- barrier */

#define BAR_THREADS 4
#define BAR_ROUNDS 50

static pthread_barrier_t bar;
static pthread_mutex_t bar_m = PTHREAD_MUTEX_INITIALIZER;
static int bar_serial;

static void *bar_worker(void *arg)
{
    (void)arg;
    for (int r = 0; r < BAR_ROUNDS; r++) {
        int rc = pthread_barrier_wait(&bar);
        if (rc == PTHREAD_BARRIER_SERIAL_THREAD) {
            die_rc(pthread_mutex_lock(&bar_m), "lock");
            bar_serial++;
            die_rc(pthread_mutex_unlock(&bar_m), "unlock");
        } else if (rc != 0) {
            die_rc(rc, "barrier_wait");
        }
    }
    return NULL;
}

static void test_barrier(void)
{
    die_rc(pthread_barrier_init(&bar, NULL, BAR_THREADS), "barrier_init");
    pthread_t t[BAR_THREADS];
    for (int i = 0; i < BAR_THREADS; i++)
        die_rc(pthread_create(&t[i], NULL, bar_worker, NULL), "create");
    for (int i = 0; i < BAR_THREADS; i++)
        die_rc(pthread_join(t[i], NULL), "join");
    pthread_barrier_destroy(&bar);
    CHECK(bar_serial == BAR_ROUNDS, "serial thread count %d, expected %d", bar_serial, BAR_ROUNDS);
}

int main(void)
{
    test_mutex();
    test_cond_prodcons();
    test_cond_timedwait();
    test_cond_broadcast();
    test_sem();
    test_barrier();

    /* Exact Tier F event counts this program produces under the shim. */
    printf("LPEXPECT MUTEX_TRYLOCK_FAIL 1\n");
    printf("LPEXPECT COND_SIGNAL %d\n", PC_ITEMS);
    printf("LPEXPECT COND_BROADCAST 2\n");
    printf("LPEXPECT SEM_POST %d\n", 2 * SEM_ROUNDS + 1);
    printf("LPEXPECT SEM_WAIT_ENTER %d\n", 2 * SEM_ROUNDS + 1);  /* + timedwait */
    printf("LPEXPECT SEM_WAIT_EXIT %d\n", 2 * SEM_ROUNDS + 1);   /* + trywait success */
    printf("LPEXPECT SEM_TRYWAIT_FAIL 1\n");
    printf("LPEXPECT BARRIER_ENTER %d\n", BAR_THREADS * BAR_ROUNDS);
    printf("LPEXPECT BARRIER_EXIT %d\n", BAR_THREADS * BAR_ROUNDS);
    printf("LPEXPECT ERROR 2\n"); /* cond_timedwait + sem_timedwait ETIMEDOUT */

    if (g_failed) {
        printf("selftest: FAILED\n");
        return 1;
    }
    printf("selftest: ok\n");
    return 0;
}
